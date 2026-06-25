import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp } from "@/lib/server/firebase-admin";
import { settlementSchema } from "@/lib/domain/schemas";
import { toMillis } from "@/lib/timestamp";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = settlementSchema.parse(body);

    const groupSnap = await adminDb.collection("groups").doc(parsed.groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    const groupData = groupSnap.data()!;
    assertGroupMembership(groupData, auth.walletAddress);

    const ref = adminDb.collection("groups").doc(parsed.groupId).collection("settlementPayments").doc(parsed.settlementKey);
    const existing = await ref.get();
    const existingData = existing.data();
    const existingStatus = existingData?.settlementStatus ?? existingData?.status;

    if (existingStatus === "paid") {
      return okResponse({ success: true, skipped: true });
    }
    if (existingStatus === "pending" && parsed.status === "pending") {
      return errorResponse("This settlement is already pending.", 409);
    }

    const now = serverTimestamp();

    const paymentPayload: Record<string, unknown> = {
      ...parsed,
      groupId: parsed.groupId,
      settlementTokenUsed: parsed.currency,
      settlementStatus: parsed.status,
      settledAt: parsed.status === "paid" ? now : (existingData?.settledAt ?? null),
      createdAt: existing.exists ? (existingData?.createdAt ?? now) : now,
      updatedAt: now,
    };

    if (parsed.status !== "paid") {
      await ref.set(paymentPayload, { merge: true });

      const eventType = parsed.status === "pending" ? "settlement.initiated" : "settlement.failed";
      const description = parsed.status === "pending"
        ? `${parsed.from} started a settlement to ${parsed.to}.`
        : `${parsed.from}'s settlement to ${parsed.to} failed.`;

      await adminDb.collection("groups").doc(parsed.groupId).collection("activity").add({
        groupId: parsed.groupId,
        eventType,
        actorName: parsed.from,
        description,
        metadata: { settlementKey: parsed.settlementKey, from: parsed.from, to: parsed.to, amount: parsed.amount, token: parsed.currency },
        createdAt: now,
      });

      return okResponse({ success: true });
    }

    const settlementAt = Date.now();
    const batch = adminDb.batch();

    batch.set(ref, { ...paymentPayload, settledAt: settlementAt }, { merge: true });

    batch.set(adminDb.collection("groups").doc(parsed.groupId), {
      firstSettlementAt: groupData.firstSettlementAt ?? settlementAt,
    }, { merge: true });

    const nestedExpenses = await adminDb.collection("groups").doc(parsed.groupId).collection("expenses").get();
    nestedExpenses.forEach((doc) => {
      const d = doc.data();
      const createdAt = toMillis(d.createdAt);
      if (!d.lockedAt && createdAt <= settlementAt) {
        batch.set(doc.ref, { lockedAt: settlementAt }, { merge: true });
      }
    });

    const legacyExpenses = await adminDb.collection("expenses").where("groupId", "==", parsed.groupId).get();
    legacyExpenses.forEach((doc) => {
      const d = doc.data();
      const createdAt = toMillis(d.createdAt);
      if (!d.lockedAt && createdAt <= settlementAt) {
        batch.set(doc.ref, { lockedAt: settlementAt }, { merge: true });
      }
    });

    await batch.commit();

    await adminDb.collection("groups").doc(parsed.groupId).collection("activity").add({
      groupId: parsed.groupId,
      eventType: "settlement.completed",
      actorName: parsed.from,
      description: `${parsed.from} paid ${parsed.to}.`,
      metadata: { settlementKey: parsed.settlementKey, from: parsed.from, to: parsed.to, amount: parsed.amount, token: parsed.currency, txHash: parsed.txHash ?? "" },
      createdAt: now,
    });

    return okResponse({ success: true });
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "settlements.POST");
  }
}

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    if (!groupId) {
      return errorResponse("groupId query parameter is required.", 400);
    }

    const snap = await adminDb.collection("groups").doc(groupId).collection("settlementPayments").get();
    const paymentMap = new Map<string, Record<string, unknown>>();

    snap.forEach((doc) => {
      const data = doc.data();
      const amount = Number(data.amount ?? 0);
      const settlementKey = data.from && data.to && Number.isFinite(amount)
        ? encodeURIComponent(`${data.from}__${data.to}__${amount.toFixed(2)}`)
        : (data.settlementKey ?? doc.id);
      const existing = paymentMap.get(settlementKey);
      const status = (data.settlementStatus ?? data.status ?? "pending") as string;
      const dataUpdatedAt = Number(data.updatedAt ?? 0);
      const existingUpdatedAt = existing ? Number(existing.updatedAt ?? 0) : 0;
      if (!existing || (status === "paid" || (status !== "paid" && dataUpdatedAt > existingUpdatedAt))) {
        paymentMap.set(settlementKey, {
          id: doc.id,
          groupId,
          settlementKey,
          from: data.from ?? "",
          to: data.to ?? "",
          payerWallet: data.payerWallet ?? "",
          receiverWallet: data.receiverWallet ?? "",
          amount,
          currency: data.settlementTokenUsed ?? data.currency ?? "USDC",
          settlementTokenUsed: data.settlementTokenUsed ?? data.currency ?? "USDC",
          status,
          settlementStatus: status,
          batchId: data.batchId ?? undefined,
          txHash: data.txHash ?? "",
          settledAt: data.settledAt ? toMillis(data.settledAt) : undefined,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        });
      }
    });

    return okResponse({ payments: [...paymentMap.values()] });
  } catch (error) {
    return handleError(error, "settlements.GET");
  }
}
