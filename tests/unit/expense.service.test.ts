import { describe, it, expect, vi } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';

// ─── DUMMY ──────────────────────────────────────
// Un logger qui satisfait l'interface sans apporter de comportement testable.
const dummyLogger: Logger = {
  info: () => {},
  error: () => {},
};

// ─── STUB ───────────────────────────────────────
// Remplace l'heure système par une valeur fixe pour un test déterministe.
const stubClock: Clock = {
  now: () => new Date('2026-06-01T10:00:00.000Z'),
};

class FakeExpenseRepository implements ExpenseRepository {
  public savedExpenses: Expense[] = [];

  async save(expense: Expense): Promise<void> {
    this.savedExpenses.push(expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.savedExpenses.find((expense) => expense.id === id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return this.savedExpenses.filter((expense) => expense.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return this.savedExpenses.filter(
      (expense) =>
        expense.groupId === groupId &&
        expense.paidAt >= from &&
        expense.paidAt <= to,
    );
  }
}

// ─── SPY ────────────────────────────────────────
// On observe les appels au notifier sans en changer le comportement.
const createSpyNotifier = () => ({
  notifyGroupMembers: vi.fn<Promise<void>, [string, string]>(() => Promise.resolve()),
});

// ─── MOCK ───────────────────────────────────────
// Générateur d'ID avec vérification du nombre d'appels et de la valeur retournée.
const createMockIdGenerator = () => ({
  next: vi.fn(() => 'expense-123'),
});

// ─── FAKE ──────────────────────────────────────
// Repository en mémoire qui stocke réellement les dépenses pour vérification.
const createFakeRepo = () => new FakeExpenseRepository();

const createExpenseInput = (amount: number): CreateExpenseInput => ({
  groupId: 'group-1',
  description: 'A nice dinner',
  amount,
  currency: 'EUR',
  paidBy: 'alice',
  paidAt: new Date('2026-06-01T12:00:00.000Z'),
  split: {
    mode: 'equal',
    beneficiaries: ['alice'],
  },
});

describe('ExpenseService.create', () => {
  it('should save the expense and notify for amount >= 100', async () => {
    const fakeRepo = createFakeRepo();
    const spyNotifier = createSpyNotifier();
    const mockIdGen = createMockIdGenerator();

    const service = new ExpenseService(
      fakeRepo,
      spyNotifier,
      stubClock,
      mockIdGen,
      dummyLogger,
    );

    const input = createExpenseInput(150);
    const expense = await service.create(input);

    expect(expense).toEqual({
      ...input,
      id: 'expense-123',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    expect(fakeRepo.savedExpenses).toEqual([expense]);
    expect(spyNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-1',
      'Nouvelle dépense importante : A nice dinner (150€)',
    );
    expect(spyNotifier.notifyGroupMembers).toHaveBeenCalledTimes(1);
    expect(mockIdGen.next).toHaveBeenCalledTimes(1);
  });

  it('should not notify when amount is below 100', async () => {
    const fakeRepo = createFakeRepo();
    const spyNotifier = createSpyNotifier();
    const mockIdGen = createMockIdGenerator();

    const service = new ExpenseService(
      fakeRepo,
      spyNotifier,
      stubClock,
      mockIdGen,
      dummyLogger,
    );

    const input = createExpenseInput(50);
    const expense = await service.create(input);

    expect(expense).toEqual({
      ...input,
      id: 'expense-123',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    expect(fakeRepo.savedExpenses).toEqual([expense]);
    expect(spyNotifier.notifyGroupMembers).not.toHaveBeenCalled();
    expect(mockIdGen.next).toHaveBeenCalledTimes(1);
  });
});