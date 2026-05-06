import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense } from '../../src/domain/types';

describe('computeBalances', () => {
  const createGroup = (members: { id: string; name: string; email: string }[]): Group => ({
    id: 'group-1',
    name: 'Test Group',
    currency: 'EUR',
    members,
  });

  const createExpense = (
    id: string,
    paidBy: string,
    amount: number,
    split: Expense['split']
  ): Expense => ({
    id,
    groupId: 'group-1',
    description: 'Test expense',
    amount,
    currency: 'EUR',
    paidBy,
    paidAt: new Date(),
    split,
    createdAt: new Date(),
  });

  it('should return zero balances for empty group', () => {
    const group = createGroup([]);
    const expenses: Expense[] = [];
    const balances = computeBalances(group, expenses);
    expect(balances).toEqual({});
  });

  it('should handle equal split with 3 people including payeur', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
      { id: 'c', name: 'Charlie', email: 'charlie@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 30, {
      mode: 'equal',
      beneficiaries: ['a', 'b', 'c'],
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: 30 - 10, // 20
      b: -10,
      c: -10,
    });
  });

  it('should handle equal split with 3 people excluding payeur', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
      { id: 'c', name: 'Charlie', email: 'charlie@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 30, {
      mode: 'equal',
      beneficiaries: ['b', 'c'],
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: 30,
      b: -15,
      c: -15,
    });
  });

  it('should handle multiple expenses that partially compensate', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
    ];
    const group = createGroup(members);
    const expenses = [
      createExpense('exp-1', 'a', 20, { mode: 'equal', beneficiaries: ['a', 'b'] }),
      createExpense('exp-2', 'b', 10, { mode: 'equal', beneficiaries: ['a', 'b'] }),
    ];
    const balances = computeBalances(group, expenses);
    expect(balances).toEqual({
      a: 10 - 5, // 5
      b: -10 + 5, // -5
    });
  });

  it('should handle weighted split with non-uniform weights', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
      { id: 'c', name: 'Charlie', email: 'charlie@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 100, {
      mode: 'weighted',
      weights: { a: 1, b: 2, c: 3 },
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: 100 - (1 / 6) * 100, // 100 - 16.666... ≈ 83.333
      b: - (2 / 6) * 100, // -33.333
      c: - (3 / 6) * 100, // -50
    });
  });

  it('should handle percentage split with rounding', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
      { id: 'c', name: 'Charlie', email: 'charlie@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 100, {
      mode: 'percentage',
      percentages: { a: 33.33, b: 33.33, c: 33.34 },
    });
    const balances = computeBalances(group, [expense]);
    expect(balances.a).toBeCloseTo(100 - 33.33, 2);
    expect(balances.b).toBeCloseTo(-33.33, 2);
    expect(balances.c).toBeCloseTo(-33.34, 2);
  });

  // Edge cases
  it('should ignore expenses for members not in group', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'old-member', 10, {
      mode: 'equal',
      beneficiaries: ['a'],
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: -10, // Only the beneficiary deduction
    });
  });

  it('should allow zero amount expense', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 0, {
      mode: 'equal',
      beneficiaries: ['a', 'b'],
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: 0,
      b: 0,
    });
  });

  it('should handle expense with single beneficiary (payeur himself)', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
    ];
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'a', 10, {
      mode: 'equal',
      beneficiaries: ['a'],
    });
    const balances = computeBalances(group, [expense]);
    expect(balances).toEqual({
      a: 10 - 10, // 0
    });
  });

  it('should handle empty expenses list', () => {
    const members = [
      { id: 'a', name: 'Alice', email: 'alice@example.com' },
      { id: 'b', name: 'Bob', email: 'bob@example.com' },
    ];
    const group = createGroup(members);
    const balances = computeBalances(group, []);
    expect(balances).toEqual({
      a: 0,
      b: 0,
    });
  });

  it('should handle large number of members (10+)', () => {
    const members = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`,
      name: `Member ${i}`,
      email: `member${i}@example.com`,
    }));
    const group = createGroup(members);
    const expense = createExpense('exp-1', 'm0', 120, {
      mode: 'equal',
      beneficiaries: members.map(m => m.id),
    });
    const balances = computeBalances(group, [expense]);
    expect(Object.keys(balances)).toHaveLength(12);
    expect(balances.m0).toBeCloseTo(120 - 10, 2); // 110
    for (let i = 1; i < 12; i++) {
      expect(balances[`m${i}`]).toBeCloseTo(-10, 2);
    }
  });
});