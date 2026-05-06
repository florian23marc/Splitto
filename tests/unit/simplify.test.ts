import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('should settle a simple 2-person balance with one settlement', () => {
    const settlements = simplifyDebts({ a: 10, b: -10 });
    expect(settlements).toEqual([{ from: 'b', to: 'a', amount: 10 }]);
  });
});
