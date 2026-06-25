import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";
import { groupBaseSchema } from "@/lib/schemas";
import { toMillis } from "@/lib/timestamp";

function generateInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

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

async function readProfile(walletAddress: string) {
  const profileId = await getProfileIdForWallet(walletAddress);
  if (!profileId) return null;
  const snap = await adminDb.collection("users").doc(profileId).get();
  if (!snap.exists) return null;
  return snap.data() as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = groupBaseSchema.parse(body);

    const callerWallet = parsed.createdBy ?? auth.walletAddress;
    const inviteCode = generateInviteCode();

    const members: Array<Record<string, unknown>> = parsed.members.map((m) => ({
      id: m.id ?? `member-${crypto.randomUUID()}`,
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

    const ref = await adminDb.collection("groups").add(payload);
    const groupId = ref.id;

    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "group.created",
      actorName: "StableSplit",
      description: `${parsed.name} was created.`,
      metadata: { groupName: parsed.name, currency: parsed.currency, memberCount: members.length },
      createdAt: serverTimestamp(),
    });

    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "invite.generated",
      actorName: "StableSplit",
      description: `Invite link created for ${parsed.name}.`,
      metadata: { inviteCode },
      createdAt: serverTimestamp(),
    });

    return okResponse({ groupId }, 201);
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    console.error("[groups.POST] Full error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return handleError(error, "groups.POST");
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
