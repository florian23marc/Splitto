import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('should settle a simple 2-person balance with one settlement', () => {
    const settlements = simplifyDebts({ a: 10, b: -10 });
    expect(settlements).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });

  it('should settle a triangle debt with a single settlement', () => {
    const settlements = simplifyDebts({ a: 10, b: 0, c: -10 });
    expect(settlements).toEqual([{ from: 'c', to: 'a', amount: 10 }]);
  });

  it('should settle a complex group with minimum number of settlements', () => {
    const settlements = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });
    expect(settlements).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 10 },
    ]);
  });

  it('should ignore zero balances and return empty list when everything is settled', () => {
    const settlements = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(settlements).toEqual([]);
  });

  it('should settle uneven compositions with the fewest transactions', () => {
    const settlements = simplifyDebts({ a: 50, b: -20, c: -20, d: -10 });
    expect(settlements).toEqual([
      { from: 'b', to: 'a', amount: 20 },
      { from: 'c', to: 'a', amount: 20 },
      { from: 'd', to: 'a', amount: 10 },
    ]);
  });
});