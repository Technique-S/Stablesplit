import { Expense, Balance, Member, Settlement } from "./types";
import { memberNames } from "./members";

const CENTS = 100;

function toCents(amount: number): number {
  return Math.round(amount * CENTS);
}

function fromCents(cents: number): number {
  return Math.round(cents) / CENTS;
}

export function calculateBalances(
  members: string[] | Member[],
  expenses: Expense[]
): Balance[] {
  const balanceMap: Record<string, number> = {};
  const names = typeof members[0] === "object" ? memberNames(members as Member[]) : (members as string[]);
  const allMembers = new Set(names);
  expenses.forEach((expense) => {
    allMembers.add(expense.paidBy);
    expense.splitAmong.forEach((member) => allMembers.add(member));
  });
  allMembers.forEach((m) => (balanceMap[m] = 0));

  for (const expense of expenses) {
    if (!expense.splitAmong.length) continue;

    const amountCents = toCents(expense.amount);
    const baseShare = Math.floor(amountCents / expense.splitAmong.length);
    let remainder = amountCents % expense.splitAmong.length;

    balanceMap[expense.paidBy] = (balanceMap[expense.paidBy] || 0) + amountCents;

    for (const member of expense.splitAmong) {
      const memberShare = baseShare + (remainder > 0 ? 1 : 0);
      balanceMap[member] = (balanceMap[member] || 0) - memberShare;
      remainder -= 1;
    }
  }

  return [...allMembers].map((m) => ({ member: m, net: fromCents(balanceMap[m] || 0) }));
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > 0.01)
    .map((b) => ({ member: b.member, net: toCents(b.net) }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((b) => b.net < -0.01)
    .map((b) => ({ member: b.member, net: toCents(b.net) }))
    .sort((a, b) => a.net - b.net);

  const settlements: Settlement[] = [];

  let i = 0;
  let j = 0;

  // Splitwise-style simplification: only net positions matter. Each loop pairs
  // the largest remaining creditor with the largest remaining debtor, records a
  // partial payment if needed, and advances whichever side is fully settled.
  // This supports one person paying multiple people and avoids duplicate
  // bidirectional debts because every member exists on only one side of the net.
  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i].net;
    const debt = Math.abs(debtors[j].net);
    const amount = Math.min(credit, debt);

    if (amount > 0) {
      settlements.push({
        from: debtors[j].member,
        to: creditors[i].member,
        amount: fromCents(amount),
      });
    }

    creditors[i].net -= amount;
    debtors[j].net += amount;

    if (creditors[i].net <= 0) i++;
    if (Math.abs(debtors[j].net) <= 0) j++;
  }

  return settlements;
}

/** Count of individual debtor-creditor pairs before net settlement optimization.
 *  Each expense creates one debt per non-payer in the split. */
export function calculateNaiveSettlementCount(expenses: Expense[]): number {
  let count = 0;
  for (const expense of expenses) {
    for (const member of expense.splitAmong) {
      if (member !== expense.paidBy) count++;
    }
  }
  return count;
}

export function normalizeExpenses(expenses: Expense[], field: "baseUsdAmount" | "baseEurAmount"): Expense[] {
  return expenses.map((e) => ({
    ...e,
    amount: e[field] ?? e.amount,
  }));
}

export const CATEGORY_ICONS: Record<string, string> = {
  food: "🍽️",
  transport: "🚗",
  accommodation: "🏠",
  entertainment: "🎬",
  utilities: "⚡",
  other: "📦",
};

export const CATEGORY_COLORS: Record<string, string> = {
  food: "var(--category-food)",
  transport: "var(--category-transport)",
  accommodation: "var(--category-accommodation)",
  entertainment: "var(--category-entertainment)",
  utilities: "var(--category-utilities)",
  other: "var(--category-other)",
};

export const CATEGORY_BACKGROUNDS: Record<string, string> = {
  food: "var(--category-food-bg)",
  transport: "var(--category-transport-bg)",
  accommodation: "var(--category-accommodation-bg)",
  entertainment: "var(--category-entertainment-bg)",
  utilities: "var(--category-utilities-bg)",
  other: "var(--category-other-bg)",
};
