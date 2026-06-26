import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp } from "@/lib/server/firebase-admin";
import { groupBaseSchema } from "@/lib/domain/schemas";
import { toMillis } from "@/lib/timestamp";
import { safeRandomUUID, generateInviteCode } from "@/lib/server/crypto-utils";

async function getProfileIdForWallet(walletAddress: string): Promise<string | null> {
  const addr = walletAddress.toLowerCase();
  const linkSnap = await adminDb.collection("walletLinks").doc(addr).get();
  if (linkSnap.exists) {
    return linkSnap.data()!.profileId as string;
  }
  const legacySnap = await adminDb.collection("users").doc(addr).get();
  if (legacySnap.exists) {
    return (legacySnap.data()!.profileId as string) || addr;
  }
  return null;
}

async function readProfile(walletAddress: string): Promise<Record<string, unknown> | null> {
  const profileId = await getProfileIdForWallet(walletAddress);
  if (!profileId) return null;
  const snap = await adminDb.collection("users").doc(profileId).get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log("[groups.POST] STEP 1 - verifyAuth");
    const auth = await verifyAuth(request);
    console.log("[groups.POST] STEP 1 complete - wallet:", auth.walletAddress);

    console.log("[groups.POST] STEP 2 - request.json");
    const body = await request.json();
    console.log("[groups.POST] STEP 2 complete");

    console.log("[groups.POST] STEP 3 - schema validation");
    const parsed = groupBaseSchema.parse(body);
    console.log("[groups.POST] STEP 3 complete - name:", parsed.name);

    console.log("[groups.POST] STEP 4 - invite code generation");
    const callerWallet = parsed.createdBy ?? auth.walletAddress;
    const inviteCode = generateInviteCode();
    console.log("[groups.POST] STEP 4 complete - inviteCode:", inviteCode);

    console.log("[groups.POST] STEP 5 - build members payload");
    const members: Array<Record<string, unknown>> = parsed.members.map((m) => ({
      id: m.id ?? `member-${safeRandomUUID()}`,
      displayName: String(m.displayName ?? "").trim(),
      walletAddress: m.walletAddress ? String(m.walletAddress).trim() : undefined,
      avatarColor: m.avatarColor ? String(m.avatarColor).trim() : undefined,
      createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
      profileId: m.profileId ? String(m.profileId).trim() : undefined,
      role: m.role === "owner" || m.role === "member" ? m.role : undefined,
    }));

    if (parsed.profileId && members.length > 0 && !members[0].profileId) {
      members[0].profileId = parsed.profileId;
      members[0].role = "owner" as const;
    }

    const memberWallets: Record<string, string> = {};
    for (const m of members) {
      const w = String(m.walletAddress ?? "").trim();
      if (w) {
        memberWallets[String(m.displayName)] = w;
        memberWallets[String(m.id)] = w;
      }
    }

    const memberAddresses = members
      .map((m) => String(m.walletAddress ?? "").toLowerCase())
      .filter(Boolean) as string[];

    console.log("[groups.POST] STEP 5 complete - members:", members.length);

    console.log("[groups.POST] STEP 6 - build Firestore payload");
    const payload: Record<string, unknown> = {
      name: parsed.name,
      description: parsed.description,
      members,
      memberWallets: { ...(parsed.memberWallets ?? {}), ...memberWallets },
      memberAddresses,
      currency: parsed.currency,
      inviteCode,
      createdAt: serverTimestamp(),
      createdBy: callerWallet,
    };
    if (parsed.templateType) payload.templateType = parsed.templateType;
    console.log("[groups.POST] STEP 6 complete");

    console.log("[groups.POST] STEP 7 - Firestore write (groups.add)");
    const ref = await adminDb.collection("groups").add(payload);
    const groupId = ref.id;
    console.log("[groups.POST] STEP 7 complete - groupId:", groupId);

    console.log("[groups.POST] STEP 8a - activity write (group.created)");
    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "group.created",
      actorName: "StableSplit",
      description: `${parsed.name} was created.`,
      metadata: { groupName: parsed.name, currency: parsed.currency, memberCount: members.length },
      createdAt: serverTimestamp(),
    });
    console.log("[groups.POST] STEP 8a complete");

    console.log("[groups.POST] STEP 8b - activity write (invite.generated)");
    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "invite.generated",
      actorName: "StableSplit",
      description: `Invite link created for ${parsed.name}.`,
      metadata: { inviteCode },
      createdAt: serverTimestamp(),
    });
    console.log("[groups.POST] STEP 8b complete");

    console.log("[groups.POST] STEP 9 - return success response");
    return okResponse({ groupId }, 201);
  } catch (error) {
    console.log("[groups.POST] STEP FAILED");
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    console.error("[groups.POST] Full error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      details: (error as any)?.details,
    });
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    const profileData = await readProfile(auth.walletAddress);
    if (!profileData) {
      return okResponse({ groups: [] });
    }

    const createdIds: string[] = (profileData.createdGroupIds as string[]) ?? [];
    const joinedIds: string[] = (profileData.joinedGroupIds as string[]) ?? [];
    const allIds = [...new Set([...createdIds, ...joinedIds])];

    const groups: Record<string, unknown>[] = [];
    for (let i = 0; i < allIds.length; i += 30) {
      const batch = allIds.slice(i, i + 30);
      const snap = await adminDb.collection("groups").where("__name__", "in", batch).get();
      snap.forEach((doc) => {
        const data = doc.data();
        const createdAt = toMillis(data.createdAt);
        const memberWallets = data.memberWallets ?? {};
        groups.push({
          id: doc.id,
          name: data.name ?? "",
          description: data.description ?? "",
          members: data.members ?? [],
          memberWallets,
          currency: data.currency ?? "USD",
          createdAt,
          firstSettlementAt: data.firstSettlementAt ? toMillis(data.firstSettlementAt) : undefined,
          isDemo: data.isDemo ?? false,
          inviteCode: data.inviteCode ?? undefined,
          photoURL: data.photoURL ?? undefined,
          templateType: data.templateType ?? undefined,
          createdBy: data.createdBy ?? undefined,
        });
      });
    }

    const createdSet = new Set(createdIds);
    groups.sort((a, b) => {
      const aCreated = createdSet.has(a.id as string) ? 0 : 1;
      const bCreated = createdSet.has(b.id as string) ? 0 : 1;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return (b.createdAt as number) - (a.createdAt as number);
    });

    return okResponse({ groups });
  } catch (error) {
    return handleError(error, "groups.GET");
  }
}
