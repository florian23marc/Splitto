import type { Balances, Settlement } from './types';

const EPSILON = 1e-9;

export function simplifyDebts(balances: Balances): Settlement[] {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -EPSILON)
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((a, b) => a.amount - b.amount); // more negative first

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, -debtor.amount);

    settlements.push({
      from: debtor.memberId,
      to: creditor.memberId,
      amount,
    });

    creditor.amount -= amount;
    debtor.amount += amount;

    if (Math.abs(creditor.amount) <= EPSILON) {
      creditorIndex += 1;
    }
    if (Math.abs(debtor.amount) <= EPSILON) {
      debtorIndex += 1;
    }
  }

  return settlements;
}
