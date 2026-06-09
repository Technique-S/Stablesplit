import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const createExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  paidBy: z.string().min(1),
  splitAmong: z.array(z.string()).min(1),
  category: z.enum(["food", "transport", "accommodation", "entertainment", "utilities", "other"]),
  date: z.number().optional(),
  notes: z.string().optional(),
  recurrence: z.object({
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    nextDate: z.number(),
    isPaused: z.boolean(),
  }).optional(),
  originalCurrency: z.string().optional(),
  baseUsdAmount: z.number().optional(),
  baseEurAmount: z.number().optional(),
  fxRate: z.number().optional(),
});

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
    const createdBy = String(groupData.createdBy ?? "").toLowerCase();
    const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];
    const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];

    const isOwner = createdBy === auth.walletAddress;
    const isMember = memberAddresses.includes(auth.walletAddress) ||
      members.some((m) => String(m.walletAddress ?? "").toLowerCase() === auth.walletAddress);
    if (!isOwner && !isMember) {
      return errorResponse("You are not a member of this group.", 403);
    }

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
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "expenses.POST");
  }
}
