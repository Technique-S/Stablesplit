import type { ActivityRecord, SettlementPayment } from "../types";

export function formatDate(value: number): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function formatDateTime(value: number): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function formatDateForInput(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function groupActivityByDate(activity: ActivityRecord[]): Record<string, ActivityRecord[]> {
  return activity.reduce<Record<string, ActivityRecord[]>>((groups, record) => {
    const label = new Date(record.createdAt).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
    (groups[label] = groups[label] ?? []).push(record);
    return groups;
  }, {});
}

export function getPaymentDate(payment: SettlementPayment): number {
  return payment.settledAt ?? payment.updatedAt ?? payment.createdAt;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  return startOfDay(ts) - d.getDay() * 86400000;
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function startOfNextMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
