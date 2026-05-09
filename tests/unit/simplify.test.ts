import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('should settle a simple 2-person balance with one settlement', () => {
    const settlements = simplifyDebts({ a: 10, b: -10 });
    expect(settlements).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('should settle a 3-person triangle with one settlement', () => {
    const settlements = simplifyDebts({ a: 10, b: 0, c: -10 });
    expect(settlements).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
  });

  it('should minimize the number of settlements for a 4-person circular debt', () => {
    const settlements = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });
    expect(settlements).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('should ignore zero balances and still compute correct settlements', () => {
    const settlements = simplifyDebts({ a: 15, b: -5, c: -10, d: 0 });
    expect(settlements).toHaveLength(2);
    expect(settlements).toEqual(
      expect.arrayContaining([
        { from: 'b', to: 'a', amount: 5 },
        { from: 'c', to: 'a', amount: 10 },
      ]),
    );
  });

  it('should ignore extremely small residual balances when settling debts', () => {
    const settlements = simplifyDebts({ a: 10, b: -10, c: 1e-10, d: -1e-10 });
    expect(settlements).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('should settle a complex multi-round case with unsorted insertion order', () => {
    const settlements = simplifyDebts({ b: -12, a: 7, d: -5, c: 10 });
    expect(settlements).toEqual([
      { from: 'b', to: 'c', amount: 10 },
      { from: 'b', to: 'a', amount: 2 },
      { from: 'd', to: 'a', amount: 5 },
    ]);
  });
});
