import { apiRequest } from "../client/api-client";
import type { RecurrenceFrequency } from "../types";

export function getNextRecurrenceDate(frequency: RecurrenceFrequency, fromDate: number): number {
  const d = new Date(fromDate);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.getTime();
}

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export async function generateNextOccurrence(groupId: string, expenseId: string): Promise<void> {
  await apiRequest("POST", "/api/expenses/recurrence", {
    groupId,
    expenseId,
    operation: "generate",
  });
}

export async function pauseRecurrence(groupId: string, expenseId: string): Promise<void> {
  await apiRequest("POST", "/api/expenses/recurrence", {
    groupId,
    expenseId,
    operation: "pause",
  });
}

export async function resumeRecurrence(groupId: string, expenseId: string): Promise<void> {
  await apiRequest("POST", "/api/expenses/recurrence", {
    groupId,
    expenseId,
    operation: "resume",
  });
}

export async function deleteRecurrence(groupId: string, expenseId: string): Promise<void> {
  await apiRequest("POST", "/api/expenses/recurrence", {
    groupId,
    expenseId,
    operation: "delete",
  });
}
