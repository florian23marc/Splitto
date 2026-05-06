import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const entries = Object.entries(balances).filter(([, balance]) => balance !== 0);
  if (entries.length !== 2) {
    return [];
  }

  const [[firstId, firstBalance], [secondId, secondBalance]] = entries;

  if (firstBalance === 0 || secondBalance === 0) {
    return [];
  }

  const creditor = firstBalance > 0 ? [firstId, firstBalance] : [secondId, secondBalance];
  const debtor = firstBalance < 0 ? [firstId, firstBalance] : [secondId, secondBalance];

  return [{
    from: debtor[0],
    to: creditor[0],
    amount: Math.min(creditor[1], -debtor[1]),
  }];
}
