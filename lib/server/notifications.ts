import { adminDb, serverTimestamp, resolveProfileId } from "./firebase-admin";
import type { NotificationPayload, NotificationType } from "@/lib/constants/notification-types";

export async function createNotification(profileId: string, payload: NotificationPayload): Promise<void> {
  try {
    await adminDb.collection("users").doc(profileId).collection("notifications").add({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      groupId: payload.groupId ?? null,
      groupName: payload.groupName ?? null,
      actorName: payload.actorName ?? null,
      metadata: payload.metadata ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[Notification] Failed to create notification", {
      profileId,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function resolveMemberProfileId(member: Record<string, unknown>): Promise<string | null> {
  if (member.profileId) {
    return member.profileId as string;
  }
  const wallet = (member.walletAddress as string) ?? "";
  if (wallet) {
    try {
      return await resolveProfileId(wallet);
    } catch {
      return null;
    }
  }
  return null;
}

export async function notifyGroupMembers(
  groupId: string,
  excludeProfileId: string | null,
  payload: NotificationPayload
): Promise<void> {
  try {
    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) return;

    const groupData = groupSnap.data()!;
    const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];
    if (members.length === 0) return;

    const profileIds = new Set<string>();

    for (const member of members) {
      const pid = await resolveMemberProfileId(member);
      if (pid && pid !== excludeProfileId) {
        profileIds.add(pid);
      }
    }

    if (profileIds.size === 0) return;

    let batch = adminDb.batch();
    let opCount = 0;

    for (const pid of profileIds) {
      const ref = adminDb.collection("users").doc(pid).collection("notifications").doc();
      batch.set(ref, {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        groupId: payload.groupId ?? groupId,
        groupName: payload.groupName ?? null,
        actorName: payload.actorName ?? null,
        metadata: payload.metadata ?? null,
        read: false,
        createdAt: serverTimestamp(),
      });
      opCount++;

      if (opCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("[Notification] notifyGroupMembers failed", {
      groupId,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifySpecificMembers(
  profileIds: string[],
  payload: NotificationPayload
): Promise<void> {
  if (profileIds.length === 0) return;

  try {
    const uniqueIds = [...new Set(profileIds)];
    const batch = adminDb.batch();

    for (const pid of uniqueIds) {
      const ref = adminDb.collection("users").doc(pid).collection("notifications").doc();
      batch.set(ref, {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        groupId: payload.groupId ?? null,
        groupName: payload.groupName ?? null,
        actorName: payload.actorName ?? null,
        metadata: payload.metadata ?? null,
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    console.error("[Notification] notifySpecificMembers failed", {
      profileIds,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyProfileOwner(
  walletAddress: string,
  payload: NotificationPayload
): Promise<void> {
  try {
    const profileId = await resolveProfileId(walletAddress);
    if (!profileId) return;
    await createNotification(profileId, payload);
  } catch (err) {
    console.error("[Notification] notifyProfileOwner failed", {
      walletAddress,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
