import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import express from 'express';
import { Pool } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createApp } from '../../src/server';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let container: PostgreSqlContainer;
let pool: Pool;
let server: ReturnType<express.Application['listen']>;
const port = 1236;

async function runMigrations(pgPool: Pool) {
  const migrationPath = path.resolve(__dirname, '../../migrations/001-initial.sql');
  const sql = await import('node:fs/promises').then((fs) => fs.readFile(migrationPath, 'utf8'));
  await pgPool.query(sql);
}

async function resetDatabase() {
  await pool.query('TRUNCATE groups CASCADE');
}

async function setupGroupWithExpenses() {
  await resetDatabase();
  await pool.query('INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)', [
    'group-1',
    'Test group',
    'EUR',
  ]);
  await pool.query('INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)', [
    'alice',
    'group-1',
    'Alice',
    'alice@example.com',
  ]);
  await pool.query('INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)', [
    'bob',
    'group-1',
    'Bob',
    'bob@example.com',
  ]);
  await pool.query('INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)', [
    'charlie',
    'group-1',
    'Charlie',
    'charlie@example.com',
  ]);

  await pool.query(
    `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      'expense-1',
      'group-1',
      'Pizza',
      30,
      'EUR',
      'alice',
      new Date('2026-06-01T10:00:00.000Z'),
      'equal',
      { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
      null,
      new Date('2026-06-01T10:00:00.000Z'),
    ],
  );

  await pool.query(
    `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      'expense-2',
      'group-1',
      'Coke',
      15,
      'EUR',
      'bob',
      new Date('2026-06-02T10:00:00.000Z'),
      'equal',
      { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
      null,
      new Date('2026-06-02T10:00:00.000Z'),
    ],
  );
}

describe('Balances provider pact', () => {
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
    const app = createApp(pool);
    const listener = app.listen(port);
    server = listener;
  });

  afterAll(async () => {
    await pool.end();
    if (server) {
      server.close();
    }
    await container.stop();
  });

  it('should verify the pact file against the provider', async () => {
    const verifier = new Verifier({
      providerBaseUrl: `http://localhost:${port}`,
      provider: 'splitto-api',
      pactUrls: [path.resolve(__dirname, '../../pacts/splitto-frontend-splitto-api.json')],
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await setupGroupWithExpenses();
        },
        'aucun groupe inexistant': async () => {
          await resetDatabase();
        },
      },
      publishVerificationResult: false,
      providerVersion: '1.0.0',
      logLevel: 'INFO',
    });

    const output = await verifier.verifyProvider();
    // Verification succeeded, the output format is just "finished: 0" or the status code
    expect(output).toBe('finished: 0');
  });
});