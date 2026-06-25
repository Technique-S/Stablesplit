export function formatAmount(amount: number, currency: string): string {
  return `${currency} ${Math.abs(amount).toFixed(2)}`;
}

export function formatAmountWithSign(amount: number, currency: string): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${currency} ${Math.abs(amount).toFixed(2)}`;
}
