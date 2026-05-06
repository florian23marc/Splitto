import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balances: Balances = {};

  // Initialize balances for all members
  for (const member of group.members) {
    balances[member.id] = 0;
  }

  for (const expense of expenses) {
    if (expense.groupId !== group.id) continue; // Skip expenses not in this group

    // Payeur gets the full amount
    if (balances[expense.paidBy] !== undefined) {
      balances[expense.paidBy] += expense.amount;
    }

    // Calculate shares for beneficiaries
    let beneficiaries: string[] = [];
    let shares: Record<string, number> = {};

    if (expense.split.mode === 'equal') {
      beneficiaries = expense.split.beneficiaries;
      const share = expense.amount / beneficiaries.length;
      for (const beneficiary of beneficiaries) {
        shares[beneficiary] = share;
      }
    } else if (expense.split.mode === 'weighted') {
      beneficiaries = Object.keys(expense.split.weights);
      const totalWeight = Object.values(expense.split.weights).reduce((sum, w) => sum + w, 0);
      for (const beneficiary of beneficiaries) {
        shares[beneficiary] = (expense.split.weights[beneficiary] / totalWeight) * expense.amount;
      }
    } else if (expense.split.mode === 'percentage') {
      beneficiaries = Object.keys(expense.split.percentages);
      for (const beneficiary of beneficiaries) {
        shares[beneficiary] = (expense.split.percentages[beneficiary] / 100) * expense.amount;
      }
    }

    // Subtract shares from beneficiaries
    for (const beneficiary of beneficiaries) {
      if (balances[beneficiary] !== undefined) {
        balances[beneficiary] -= shares[beneficiary];
      }
    }
  }

  return balances;
}
