import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const updateExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  paidBy: z.string().min(1).optional(),
  splitAmong: z.array(z.string()).min(1).optional(),
  category: z.enum(["food", "transport", "accommodation", "entertainment", "utilities", "other"]).optional(),
  date: z.number().optional(),
  notes: z.string().optional(),
});

async function getExpenseRef(groupId: string, expenseId: string) {
  const nestedRef = adminDb.collection("groups").doc(groupId).collection("expenses").doc(expenseId);
  const nestedSnap = await nestedRef.get();
  if (nestedSnap.exists) return { ref: nestedRef, snap: nestedSnap };

  const legacyRef = adminDb.collection("expenses").doc(expenseId);
  const legacySnap = await legacyRef.get();
  if (legacySnap.exists) return { ref: legacyRef, snap: legacySnap };

  return { ref: nestedRef, snap: nestedSnap };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    const { id: expenseId } = await params;
    const body = await request.json();
    const parsed = updateExpenseSchema.parse(body);

    const groupSnap = await adminDb.collection("groups").doc(parsed.groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    const groupData = groupSnap.data()!;
    const createdBy = String(groupData.createdBy ?? "").toLowerCase();
    const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];
    const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];

    if (createdBy !== auth.walletAddress && !memberAddresses.includes(auth.walletAddress) &&
        !members.some((m) => String(m.walletAddress ?? "").toLowerCase() === auth.walletAddress)) {
      return errorResponse("You are not a member of this group.", 403);
    }

    const { ref, snap } = await getExpenseRef(parsed.groupId, expenseId);
    if (!snap.exists) {
      return errorResponse("Expense not found.", 404);
    }

    const data = snap.data()!;
    if (data.lockedAt) {
      return errorResponse("This expense is locked because it predates a completed settlement.", 403);
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.description !== undefined) updatePayload.description = parsed.description;
    if (parsed.amount !== undefined) updatePayload.amount = parsed.amount;
    if (parsed.paidBy !== undefined) updatePayload.paidBy = parsed.paidBy;
    if (parsed.splitAmong !== undefined) updatePayload.splitAmong = parsed.splitAmong;
    if (parsed.category !== undefined) updatePayload.category = parsed.category;
    if (parsed.date !== undefined) updatePayload.date = parsed.date;
    if (parsed.notes !== undefined) updatePayload.notes = parsed.notes;

    if (Object.keys(updatePayload).length === 0) {
      return errorResponse("No fields to update.", 400);
    }

    await ref.update(updatePayload);
    return okResponse({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "expenses/[id].PATCH");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    const { id: expenseId } = await params;
    const { groupId } = await request.json().catch(() => ({})) as { groupId?: string };
    if (!groupId) {
      return errorResponse("groupId is required in request body.", 400);
    }

    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    const groupData = groupSnap.data()!;
    const createdBy = String(groupData.createdBy ?? "").toLowerCase();
    const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];
    const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];

    if (createdBy !== auth.walletAddress && !memberAddresses.includes(auth.walletAddress) &&
        !members.some((m) => String(m.walletAddress ?? "").toLowerCase() === auth.walletAddress)) {
      return errorResponse("You are not a member of this group.", 403);
    }

    const { ref, snap } = await getExpenseRef(groupId, expenseId);
    if (!snap.exists) {
      return errorResponse("Expense not found.", 404);
    }

    const data = snap.data()!;
    if (data.lockedAt) {
      return errorResponse("This expense is locked because it predates a completed settlement.", 403);
    }

    const expenseDescription = String(data.description ?? "An expense");

    await ref.delete();

    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "expense.deleted",
      actorName: "StableSplit",
      description: `${expenseDescription} was deleted.`,
      metadata: { expenseId, description: expenseDescription, amount: Number(data.amount ?? 0), paidBy: String(data.paidBy ?? "") },
      createdAt: serverTimestamp(),
    });

    return okResponse({ success: true });
  } catch (error) {
    return handleError(error, "expenses/[id].DELETE");
  }
}
