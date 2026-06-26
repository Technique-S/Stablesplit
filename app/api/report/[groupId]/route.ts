import { NextRequest } from "next/server";
import { verifyAuth, okResponse, handleError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb } from "@/lib/server/firebase-admin";
import { toMillis } from "@/lib/timestamp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    const { groupId } = await params;

    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      throw Object.assign(new Error("Group not found."), { statusCode: 404 });
    }
    const groupData = groupSnap.data()!;
    assertGroupMembership(groupData, auth.walletAddress);

    const members = Array.isArray(groupData.members) ? groupData.members : [];

    const group = {
      id: groupId,
      name: groupData.name ?? "",
      description: groupData.description ?? "",
      members,
      memberWallets: (groupData.memberWallets ?? {}) as Record<string, string>,
      currency: groupData.currency ?? "USD",
      createdAt: toMillis(groupData.createdAt),
      firstSettlementAt: groupData.firstSettlementAt ? toMillis(groupData.firstSettlementAt) : undefined,
      isDemo: groupData.isDemo ?? false,
      inviteCode: groupData.inviteCode ?? undefined,
      photoURL: groupData.photoURL ?? undefined,
      templateType: groupData.templateType ?? undefined,
      createdBy: groupData.createdBy ?? undefined,
    };

    const expSnap = await adminDb.collection("groups").doc(groupId).collection("expenses").get();
    const expenses = expSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId ?? groupId,
        description: data.description ?? "",
        amount: Number(data.amount ?? 0),
        paidBy: data.paidBy ?? "",
        splitAmong: Array.isArray(data.splitAmong) ? data.splitAmong : [],
        category: data.category ?? "other",
        createdAt: toMillis(data.createdAt),
        date: toMillis(data.date ?? data.createdAt),
        notes: data.notes ?? "",
        lockedAt: data.lockedAt ? toMillis(data.lockedAt) : undefined,
        recurrence: data.recurrence
          ? {
              frequency: data.recurrence.frequency,
              nextDate: toMillis(data.recurrence.nextDate),
              isPaused: data.recurrence.isPaused ?? false,
            }
          : undefined,
        recurrenceParentId: data.recurrenceParentId ?? undefined,
        originalCurrency: data.originalCurrency ?? undefined,
        baseUsdAmount: data.baseUsdAmount ? Number(data.baseUsdAmount) : undefined,
        baseEurAmount: data.baseEurAmount ? Number(data.baseEurAmount) : undefined,
        fxRate: data.fxRate ? Number(data.fxRate) : undefined,
      };
    });

    const paySnap = await adminDb.collection("groups").doc(groupId).collection("settlementPayments").get();
    const settlementPayments = paySnap.docs.map((d) => {
      const data = d.data();
      const status = (data.settlementStatus ?? data.status ?? "pending") as string;
      const currency = (data.settlementTokenUsed ?? data.currency ?? "USDC") as string;
      const amount = Number(data.amount ?? 0);
      return {
        id: d.id,
        groupId: data.groupId ?? "",
        settlementKey:
          data.from && data.to && Number.isFinite(amount)
            ? encodeURIComponent(`${data.from}__${data.to}__${amount.toFixed(2)}`)
            : data.settlementKey ?? d.id,
        from: data.from ?? "",
        to: data.to ?? "",
        payerWallet: data.payerWallet ?? "",
        receiverWallet: data.receiverWallet ?? "",
        amount,
        currency,
        settlementTokenUsed: currency,
        status,
        settlementStatus: status,
        batchId: data.batchId ?? undefined,
        txHash: data.txHash ?? "",
        settledAt: data.settledAt ? toMillis(data.settledAt) : undefined,
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt ?? data.createdAt),
      };
    });

    const actSnap = await adminDb.collection("groups").doc(groupId).collection("activity").get();
    const activityRecords = actSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        groupId: data.groupId ?? groupId,
        eventType: data.eventType ?? "group.description_updated",
        actorName: data.actorName ?? "",
        description: data.description ?? "",
        metadata: data.metadata ?? {},
        createdAt: toMillis(data.createdAt),
      };
    });

    return okResponse({ group, expenses, settlementPayments, activityRecords });
  } catch (error) {
    return handleError(error, "report/[groupId].GET");
  }
}
