import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const createExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: overrides.id ?? 'expense-1',
  groupId: overrides.groupId ?? 'group-1',
  description: overrides.description ?? 'Test expense',
  amount: overrides.amount ?? 100,
  currency: overrides.currency ?? 'EUR',
  paidBy: overrides.paidBy ?? 'member-1',
  paidAt: overrides.paidAt ?? new Date('2026-06-01T10:00:00.000Z'),
  split: overrides.split ?? { mode: 'equal', beneficiaries: ['member-1'] },
  createdAt: overrides.createdAt ?? new Date('2026-06-01T10:00:00.000Z'),
  category: overrides.category,
});

let container: PostgreSqlContainer;
let pool: Pool;
let repository: PgExpenseRepository;

async function runMigrations(pool: Pool) {
  const migrationPath = path.resolve(__dirname, '../../migrations/001-initial.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
}

async function createGroupAndMember(groupId: string, memberId: string) {
  await pool.query(
    'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
    [groupId, 'Test Group', 'EUR'],
  );
  await pool.query(
    'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
    [memberId, groupId, 'Member', 'member@example.com'],
  );
}

describe('PgExpenseRepository', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });

    await runMigrations(pool);
    repository = new PgExpenseRepository(pool);
  });

  afterEach(async () => {
    await pool.query('TRUNCATE expenses, members, groups CASCADE');
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it('should save then findById and return the same expense', async () => {
    await createGroupAndMember('group-1', 'member-1');
    const expense = createExpense({ id: 'expense-1' });

    await repository.save(expense);
    const persisted = await repository.findById('expense-1');

    expect(persisted).toEqual(expense);
  });

  it('should return only expenses for the requested group in findByGroupId', async () => {
    await createGroupAndMember('group-1', 'member-1');
    await createGroupAndMember('group-2', 'member-2');

    await repository.save(createExpense({ id: 'expense-1', groupId: 'group-1', paidBy: 'member-1' }));
    await repository.save(createExpense({ id: 'expense-2', groupId: 'group-1', paidBy: 'member-1', paidAt: new Date('2026-06-02T10:00:00.000Z') }));
    await repository.save(createExpense({ id: 'expense-3', groupId: 'group-2', paidBy: 'member-2' }));

    const groupExpenses = await repository.findByGroupId('group-1');

    expect(groupExpenses.map((expense) => expense.id)).toEqual(['expense-1', 'expense-2']);
    expect(groupExpenses.every((expense) => expense.groupId === 'group-1')).toBe(true);
  });

  it('should filter expenses inclusively by paidAt date range', async () => {
    await createGroupAndMember('group-1', 'member-1');

    await repository.save(createExpense({ id: 'expense-1', paidAt: new Date('2026-06-01T00:00:00.000Z') }));
    await repository.save(createExpense({ id: 'expense-2', paidAt: new Date('2026-06-10T00:00:00.000Z') }));
    await repository.save(createExpense({ id: 'expense-3', paidAt: new Date('2026-06-20T00:00:00.000Z') }));

    const results = await repository.findInDateRange(
      'group-1',
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-10T00:00:00.000Z'),
    );

    expect(results.map((expense) => expense.id)).toEqual(['expense-1', 'expense-2']);
  });

  it('should reject duplicate expenses with a unique constraint error', async () => {
    await createGroupAndMember('group-1', 'member-1');
    const paidAt = new Date('2026-06-01T10:00:00.000Z');

    await repository.save(createExpense({ id: 'expense-1', paidAt, amount: 20 }));

    await expect(
      repository.save(createExpense({ id: 'expense-2', paidAt, amount: 20 })),
    ).rejects.toThrow();
  });

  it('should rollback a failed transaction and leave no saved expenses', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)', [
        'group-rollback',
        'Rollback Group',
        'EUR',
      ]);
      await client.query(
        'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
        ['member-rollback', 'group-rollback', 'Rollbacker', 'rollback@example.com'],
      );
      await client.query(
        `INSERT INTO expenses (
          id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          'expense-rollback',
          'group-rollback',
          'Should rollback',
          10,
          'EUR',
          'member-rollback',
          new Date('2026-06-01T10:00:00.000Z'),
          'equal',
          JSON.stringify({ mode: 'equal', beneficiaries: ['member-rollback'] }),
          null,
          new Date('2026-06-01T10:00:00.000Z'),
        ],
      );
      throw new Error('Simulated failure');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const result = await pool.query('SELECT COUNT(*) FROM expenses WHERE group_id = $1', ['group-rollback']);
    expect(Number(result.rows[0].count)).toBe(0);
  });
});