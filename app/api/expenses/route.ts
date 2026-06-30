import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp, resolveProfileId } from "@/lib/server/firebase-admin";
import { notifyGroupMembers } from "@/lib/server/notifications";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createExpenseSchema } from "@/lib/domain/schemas";
import { toMillis } from "@/lib/timestamp";
import type { ExpenseCategory } from "@/lib/types";

function mapExpenseResponse(doc: FirebaseFirestore.QueryDocumentSnapshot, groupId: string): Record<string, unknown> {
  const data = doc.data();
  const toMs = (v: unknown) => (v ? toMillis(v) : undefined);
  return {
    id: doc.id,
    groupId: data.groupId ?? groupId,
    description: data.description ?? "",
    amount: Number(data.amount ?? 0),
    paidBy: data.paidBy ?? "",
    splitAmong: Array.isArray(data.splitAmong) ? data.splitAmong : [],
    category: (data.category ?? "other") as ExpenseCategory,
    createdAt: toMs(data.createdAt) ?? Date.now(),
    date: toMs(data.date ?? data.createdAt) ?? Date.now(),
    notes: data.notes ?? "",
    lockedAt: data.lockedAt ? toMs(data.lockedAt) : undefined,
    recurrence: data.recurrence
      ? {
          frequency: data.recurrence.frequency,
          nextDate: toMs(data.recurrence.nextDate),
          isPaused: data.recurrence.isPaused ?? false,
        }
      : undefined,
    recurrenceParentId: data.recurrenceParentId ?? undefined,
    originalCurrency: data.originalCurrency ?? undefined,
    baseUsdAmount: data.baseUsdAmount ? Number(data.baseUsdAmount) : undefined,
    baseEurAmount: data.baseEurAmount ? Number(data.baseEurAmount) : undefined,
    fxRate: data.fxRate ? Number(data.fxRate) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    if (!groupId) {
      return errorResponse("groupId query parameter is required.", 400);
    }

    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    assertGroupMembership(groupSnap.data()!, auth.walletAddress);

    const nestedSnap = await adminDb
      .collection("groups").doc(groupId).collection("expenses")
      .orderBy("createdAt", "desc").limit(200).get();

    const nested = nestedSnap.docs.map((d) => mapExpenseResponse(d, groupId));
    const nestedIds = new Set(nested.map((e) => e.id));

    const legacySnap = await adminDb
      .collection("expenses")
      .where("groupId", "==", groupId)
      .get();

    const legacy = legacySnap.docs
      .filter((d) => !nestedIds.has(d.id))
      .map((d) => mapExpenseResponse(d, groupId));

    const expenses = [...nested, ...legacy].sort(
      (a, b) => (b.createdAt as number) - (a.createdAt as number)
    );

    return okResponse({ expenses });
  } catch (error) {
    return handleError(error, "expenses.GET");
  }
}

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

    const groupName = String(groupData.name ?? "");
    const groupCurrency = String(groupData.currency ?? "USD");
    resolveProfileId(auth.walletAddress).then((creatorProfileId) => {
      console.log("[Notification] ENTER", { endpoint: "POST /api/expenses", type: NOTIFICATION_TYPES.EXPENSE_CREATED, groupId: parsed.groupId, actorWallet: auth.walletAddress, creatorProfileId });
      return notifyGroupMembers(parsed.groupId, creatorProfileId, {
        type: NOTIFICATION_TYPES.EXPENSE_CREATED,
        title: "New Expense",
        message: `${parsed.paidBy} added "${parsed.description}" for ${groupCurrency} ${parsed.amount}`,
        groupId: parsed.groupId,
        groupName: groupName,
        actorName: parsed.paidBy,
      }, groupData);
    }).then(() => {
      console.log("[Notification] EXIT", { endpoint: "POST /api/expenses", type: NOTIFICATION_TYPES.EXPENSE_CREATED, groupId: parsed.groupId });
    }).catch(() => {});

    return okResponse({ expenseId }, 201);
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "expenses.POST");
  }
}
