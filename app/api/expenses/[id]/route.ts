import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";
import { updateExpenseSchema } from "@/lib/schemas";

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
    if (!parsed.groupId) return errorResponse("groupId is required.", 400);

    const groupSnap = await adminDb.collection("groups").doc(parsed.groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    const groupData = groupSnap.data()!;
    assertGroupMembership(groupData, auth.walletAddress);

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
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
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
    assertGroupMembership(groupData, auth.walletAddress);

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
