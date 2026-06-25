import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";
import { createExpenseSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = createExpenseSchema.parse(body);

    const groupSnap = await adminDb.collection("groups").doc(parsed.groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }

    const groupData = groupSnap.data()!;
    assertGroupMembership(groupData, auth.walletAddress);

    const payload: Record<string, unknown> = {
      groupId: parsed.groupId,
      description: parsed.description,
      amount: parsed.amount,
      paidBy: parsed.paidBy,
      splitAmong: parsed.splitAmong,
      category: parsed.category,
      date: parsed.date ?? Date.now(),
      notes: parsed.notes ?? "",
      createdAt: serverTimestamp(),
    };

    if (parsed.recurrence) {
      payload.recurrence = {
        frequency: parsed.recurrence.frequency,
        nextDate: parsed.recurrence.nextDate,
        isPaused: parsed.recurrence.isPaused,
      };
    }
    if (parsed.originalCurrency) {
      payload.originalCurrency = parsed.originalCurrency;
      payload.baseUsdAmount = parsed.baseUsdAmount;
      payload.baseEurAmount = parsed.baseEurAmount;
      payload.fxRate = parsed.fxRate;
    }

    const ref = await adminDb.collection("groups").doc(parsed.groupId).collection("expenses").add(payload);
    const expenseId = ref.id;

    const activityMeta: Record<string, unknown> = {
      expenseId,
      description: parsed.description,
      amount: parsed.amount,
      paidBy: parsed.paidBy,
      splitAmong: parsed.splitAmong,
      category: parsed.category,
    };
    const activityDesc = parsed.recurrence
      ? `${parsed.description} was added (recurring ${parsed.recurrence.frequency}).`
      : `${parsed.description} was added.`;
    if (parsed.recurrence) {
      activityMeta.isRecurring = true;
      activityMeta.recurrenceFrequency = parsed.recurrence.frequency;
    }

    await adminDb.collection("groups").doc(parsed.groupId).collection("activity").add({
      groupId: parsed.groupId,
      eventType: "expense.created",
      actorName: parsed.paidBy || "StableSplit",
      description: activityDesc,
      metadata: activityMeta,
      createdAt: serverTimestamp(),
    });

    return okResponse({ expenseId }, 201);
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "expenses.POST");
  }
}
