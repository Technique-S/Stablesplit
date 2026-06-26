import { NextRequest } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";
import { okResponse, errorResponse, handleError } from "@/lib/server/api-utils";
import { normalizeMembers, memberWalletMap } from "@/lib/domain/members";
import { toMillis } from "@/lib/timestamp";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return errorResponse("code query parameter is required.", 400);
    }

    const snap = await adminDb.collection("groups")
      .where("inviteCode", "==", code)
      .get();

    const matching = snap.docs.filter((d) => d.data().inviteCode === code);
    if (matching.length === 0) {
      return errorResponse("Group not found for this invite code.", 404);
    }

    const group = matching[0];
    const data = group.data();
    const createdAt = toMillis(data.createdAt);
    const rawMembers = Array.isArray(data.members) ? data.members : [];
    const memberWallets = (data.memberWallets ?? {}) as Record<string, string>;
    const members = normalizeMembers(rawMembers, memberWallets, createdAt);

    return okResponse({
      id: group.id,
      name: data.name ?? "",
      description: data.description ?? "",
      members,
      memberWallets: { ...memberWallets, ...memberWalletMap(members) },
      currency: data.currency ?? "USD",
      createdAt,
      firstSettlementAt: data.firstSettlementAt ? toMillis(data.firstSettlementAt) : undefined,
      isDemo: data.isDemo ?? false,
      inviteCode: data.inviteCode ?? undefined,
      photoURL: data.photoURL ?? undefined,
      templateType: data.templateType ?? undefined,
      createdBy: data.createdBy ?? undefined,
    });
  } catch (error) {
    return handleError(error, "groups/invite.GET");
  }
}
