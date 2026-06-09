import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const upsertSchema = z.object({
  groupId: z.string().min(1),
  settlementKey: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  payerWallet: z.string().optional(),
  receiverWallet: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(["USDC", "EUR"]),
  status: z.enum(["pending", "paid", "failed"]),
  txHash: z.string().optional(),
  batchId: z.string().optional(),
  createdAt: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = upsertSchema.parse(body);

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
      const createdAt = d.createdAt?.toMillis?.() ?? d.createdAt ?? 0;
      if (!d.lockedAt && createdAt <= settlementAt) {
        batch.set(doc.ref, { lockedAt: settlementAt }, { merge: true });
      }
    });

    const legacyExpenses = await adminDb.collection("expenses").where("groupId", "==", parsed.groupId).get();
    legacyExpenses.forEach((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toMillis?.() ?? d.createdAt ?? 0;
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
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
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
          settledAt: data.settledAt?.toMillis?.() ?? data.settledAt ?? undefined,
          createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0,
          updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? 0,
        });
      }
    });

    return okResponse({ payments: [...paymentMap.values()] });
  } catch (error) {
    return handleError(error, "settlements.GET");
  }
}
