import { doc, updateDoc, deleteField, collection, addDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../client/firebase";
import { addActivityRecord } from "../client/db";
import { notifyGroupMembers } from "../client/notifications";
import type { RecurrenceFrequency, RecurrenceConfig } from "../types";

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
  const ref = doc(db, "groups", groupId, "expenses", expenseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (!data.recurrence) return;
  const recurrence = data.recurrence as RecurrenceConfig;
  if (recurrence.isPaused) return;
  if (recurrence.nextDate > Date.now()) return;

  const nextDate = getNextRecurrenceDate(recurrence.frequency, recurrence.nextDate);

  const payload: Record<string, unknown> = {
    groupId,
    description: data.description,
    amount: data.amount,
    paidBy: data.paidBy,
    splitAmong: data.splitAmong,
    category: data.category,
    notes: data.notes ?? "",
    date: recurrence.nextDate,
    createdAt: serverTimestamp(),
    recurrenceParentId: expenseId,
  };
  if (data.originalCurrency) {
    payload.originalCurrency = data.originalCurrency;
    payload.baseUsdAmount = data.baseUsdAmount;
    payload.baseEurAmount = data.baseEurAmount;
    payload.fxRate = data.fxRate;
  }

  await addDoc(collection(db, "groups", groupId, "expenses"), payload);

  await updateDoc(ref, {
    "recurrence.nextDate": nextDate,
  });

  await addActivityRecord(
    groupId,
    "expense.created",
    `${data.description} was added (recurring ${FREQUENCY_LABELS[recurrence.frequency].toLowerCase()}).`,
    {
      description: data.description,
      amount: data.amount,
      paidBy: data.paidBy,
      isRecurring: true,
      recurrenceFrequency: recurrence.frequency,
    },
    data.paidBy || "StableSplit"
  );

  try {
    const paidBy = (data.paidBy as string) ?? "";
    await notifyGroupMembers(
      groupId,
      "expense.created",
      `${paidBy}'s recurring "${data.description}" (${FREQUENCY_LABELS[recurrence.frequency].toLowerCase()}).`,
      paidBy || "StableSplit",
      [paidBy]
    );
  } catch { /* notification fire-and-forget */ }
}

export async function pauseRecurrence(groupId: string, expenseId: string): Promise<void> {
  await updateDoc(doc(db, "groups", groupId, "expenses", expenseId), {
    "recurrence.isPaused": true,
  });
}

export async function resumeRecurrence(groupId: string, expenseId: string): Promise<void> {
  await updateDoc(doc(db, "groups", groupId, "expenses", expenseId), {
    "recurrence.isPaused": false,
  });
}

export async function deleteRecurrence(groupId: string, expenseId: string): Promise<void> {
  await updateDoc(doc(db, "groups", groupId, "expenses", expenseId), {
    recurrence: deleteField(),
  });
}
