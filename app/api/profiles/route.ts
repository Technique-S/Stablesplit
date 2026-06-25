import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";
import { profileBaseSchema, patchProfileSchema } from "@/lib/schemas";
import { toMillis } from "@/lib/timestamp";

async function readOrMigrateProfile(walletAddress: string): Promise<{ profileId: string; isNew: boolean; existingData: Record<string, unknown> | null }> {
  const addr = walletAddress.toLowerCase();

  const linkSnap = await adminDb.collection("walletLinks").doc(addr).get();
  if (linkSnap.exists) {
    const profileId = linkSnap.data()!.profileId as string;
    const profileSnap = await adminDb.collection("users").doc(profileId).get();
    return { profileId, isNew: false, existingData: profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : null };
  }

  const legacySnap = await adminDb.collection("users").doc(addr).get();
  if (legacySnap.exists) {
    const legacyData = legacySnap.data() as Record<string, unknown>;
    const profileId = (legacyData.profileId as string) || addr;
    await adminDb.collection("walletLinks").doc(addr).set({ profileId, createdAt: serverTimestamp() });
    if (profileId !== addr) {
      await adminDb.collection("users").doc(profileId).set(legacyData, { merge: true });
    }
    return { profileId, isNew: false, existingData: legacyData };
  }

  const profileId = crypto.randomUUID();
  await adminDb.collection("walletLinks").doc(addr).set({ profileId, createdAt: serverTimestamp() });
  return { profileId, isNew: true, existingData: null };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = profileBaseSchema.parse(body);

    const { profileId, isNew, existingData } = await readOrMigrateProfile(auth.walletAddress);

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (parsed.displayName !== undefined) payload.displayName = parsed.displayName;
    if (parsed.avatarURL !== undefined) payload.avatarURL = parsed.avatarURL;
    if (parsed.walletAddress !== undefined) payload.walletAddress = parsed.walletAddress;
    if (isNew || !existingData) {
      payload.displayName = payload.displayName ?? "";
      payload.joinedGroupIds = existingData?.joinedGroupIds ?? [];
      payload.createdGroupIds = existingData?.createdGroupIds ?? [];
      payload.createdAt = serverTimestamp();
      payload.walletAddress = payload.walletAddress ?? auth.walletAddress;
    }

    await adminDb.collection("users").doc(profileId).set(payload, { merge: true });

    const updatedSnap = await adminDb.collection("users").doc(profileId).get();
    const updated = updatedSnap.data()!;

    return okResponse({
      profile: {
        id: profileId,
        displayName: updated.displayName ?? "",
        avatarURL: updated.avatarURL ?? undefined,
        walletAddress: updated.walletAddress ?? undefined,
        joinedGroupIds: Array.isArray(updated.joinedGroupIds) ? updated.joinedGroupIds : [],
        createdGroupIds: Array.isArray(updated.createdGroupIds) ? updated.createdGroupIds : [],
        createdAt: toMillis(updated.createdAt),
        updatedAt: toMillis(updated.updatedAt),
      },
    }, 201);
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "profiles.POST");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = patchProfileSchema.parse(body);

    let profileId = parsed.profileId;

    if (!profileId) {
      const { profileId: pid } = await readOrMigrateProfile(auth.walletAddress);
      profileId = pid;
    }

    const updatePayload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (parsed.displayName !== undefined) updatePayload.displayName = parsed.displayName;
    if (parsed.avatarURL !== undefined) updatePayload.avatarURL = parsed.avatarURL;
    if (parsed.walletAddress !== undefined) updatePayload.walletAddress = parsed.walletAddress;

    if (parsed.joinedGroupIds?.$addToSet) {
      const snap = await adminDb.collection("users").doc(profileId).get();
      const existing: string[] = Array.isArray(snap.data()?.joinedGroupIds) ? snap.data()!.joinedGroupIds : [];
      if (!existing.includes(parsed.joinedGroupIds.$addToSet)) {
        updatePayload.joinedGroupIds = [...existing, parsed.joinedGroupIds.$addToSet];
      }
    }

    if (parsed.createdGroupIds?.$addToSet) {
      const snap = await adminDb.collection("users").doc(profileId).get();
      const existingJoined: string[] = Array.isArray(snap.data()?.joinedGroupIds) ? snap.data()!.joinedGroupIds : [];
      const existingCreated: string[] = Array.isArray(snap.data()?.createdGroupIds) ? snap.data()!.createdGroupIds : [];
      if (!existingJoined.includes(parsed.createdGroupIds.$addToSet)) {
        updatePayload.joinedGroupIds = [...existingJoined, parsed.createdGroupIds.$addToSet];
      }
      if (!existingCreated.includes(parsed.createdGroupIds.$addToSet)) {
        updatePayload.createdGroupIds = [...existingCreated, parsed.createdGroupIds.$addToSet];
      }
    }

    if (Object.keys(updatePayload).length <= 1) {
      return errorResponse("No fields to update.", 400);
    }

    await adminDb.collection("users").doc(profileId).update(updatePayload);
    return okResponse({ success: true });
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "profiles.PATCH");
  }
}
