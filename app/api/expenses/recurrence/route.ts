import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp, FieldValue } from "@/lib/server/firebase-admin";
import { getNextRecurrenceDate, FREQUENCY_LABELS } from "@/lib/domain/recurrence";
import type { RecurrenceConfig } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const { groupId, expenseId, operation } = body as {
      groupId: string;
      expenseId: string;
      operation: "generate" | "pause" | "resume" | "delete";
    };

    if (!groupId || !expenseId) {
      return errorResponse("groupId and expenseId are required.", 400);
    }

    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    assertGroupMembership(groupSnap.data()!, auth.walletAddress);

    const expenseRef = adminDb.collection("groups").doc(groupId).collection("expenses").doc(expenseId);
    const expenseSnap = await expenseRef.get();
    if (!expenseSnap.exists) {
      return errorResponse("Expense not found.", 404);
    }

    const expenseData = expenseSnap.data()!;

    if (operation === "pause") {
      await expenseRef.update({ "recurrence.isPaused": true });
      return okResponse({ success: true });
    }

    if (operation === "resume") {
      await expenseRef.update({ "recurrence.isPaused": false });
      return okResponse({ success: true });
    }

    if (operation === "delete") {
      await expenseRef.update({ recurrence: FieldValue.delete() });
      return okResponse({ success: true });
    }

    if (operation === "generate") {
      if (!expenseData.recurrence) {
        return okResponse({ success: true, skipped: true, reason: "no_recurrence" });
      }

      const recurrence = expenseData.recurrence as RecurrenceConfig;
      if (recurrence.isPaused) {
        return okResponse({ success: true, skipped: true, reason: "paused" });
      }
      if (recurrence.nextDate > Date.now()) {
        return okResponse({ success: true, skipped: true, reason: "not_yet_due" });
      }

      const nextDate = getNextRecurrenceDate(recurrence.frequency, recurrence.nextDate);

      const payload: Record<string, unknown> = {
        groupId,
        description: expenseData.description,
        amount: expenseData.amount,
        paidBy: expenseData.paidBy,
        splitAmong: expenseData.splitAmong,
        category: expenseData.category,
        notes: expenseData.notes ?? "",
        date: recurrence.nextDate,
        createdAt: serverTimestamp(),
        recurrenceParentId: expenseId,
      };
      if (expenseData.originalCurrency) {
        payload.originalCurrency = expenseData.originalCurrency;
        payload.baseUsdAmount = expenseData.baseUsdAmount;
        payload.baseEurAmount = expenseData.baseEurAmount;
        payload.fxRate = expenseData.fxRate;
      }

      await adminDb.collection("groups").doc(groupId).collection("expenses").add(payload);

      await expenseRef.update({ "recurrence.nextDate": nextDate });

      const paidBy = (expenseData.paidBy as string) ?? "";
      await adminDb.collection("groups").doc(groupId).collection("activity").add({
        groupId,
        eventType: "expense.created",
        actorName: paidBy || "StableSplit",
        description: `${expenseData.description} was added (recurring ${FREQUENCY_LABELS[recurrence.frequency]?.toLowerCase() ?? recurrence.frequency}).`,
        metadata: {
          description: expenseData.description,
          amount: expenseData.amount,
          paidBy: expenseData.paidBy,
          isRecurring: true,
          recurrenceFrequency: recurrence.frequency,
        },
        createdAt: serverTimestamp(),
      });

      return okResponse({ success: true });
    }

    return errorResponse("Invalid operation.", 400);
  } catch (error) {
    return handleError(error, "expenses/recurrence.POST");
  }
}
