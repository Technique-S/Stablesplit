import { adminDb, serverTimestamp, resolveProfileId } from "./firebase-admin";
import type { NotificationPayload, NotificationType } from "@/lib/constants/notification-types";

export async function createNotification(profileId: string, payload: NotificationPayload): Promise<void> {
  try {
    console.log("[Notification] Attempting creation", {
      type: payload.type,
      recipientProfileId: profileId,
    });
    const ref = await adminDb.collection("users").doc(profileId).collection("notifications").add({
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
    console.log("[Notification] Created", {
      type: payload.type,
      recipientProfileId: profileId,
      notificationId: ref.id,
    });
  } catch (err) {
    console.error("[Notification] Failed", {
      type: payload.type,
      recipientProfileId: profileId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function resolveMemberProfileId(member: Record<string, unknown>): Promise<string | null> {
  if (member.profileId) {
    console.log("[Notification] Resolved member from profileId field", {
      memberId: member.id,
      profileId: member.profileId,
    });
    return member.profileId as string;
  }
  const wallet = (member.walletAddress as string) ?? "";
  if (wallet) {
    try {
      return await resolveProfileId(wallet);
    } catch (err) {
      console.error("[Notification] resolveMemberProfileId threw", {
        memberId: member.id,
        wallet,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
  console.warn("[Notification] Unresolvable member (no profileId, no walletAddress)", {
    memberId: member.id,
    displayName: member.displayName,
  });
  return null;
}

const BATCH_LIMIT = 400;

export async function notifyGroupMembers(
  groupId: string,
  excludeProfileId: string | null,
  payload: NotificationPayload,
  groupData?: Record<string, unknown>
): Promise<void> {
  try {
    let members: Array<Record<string, unknown>>;

    if (groupData) {
      members = Array.isArray(groupData.members) ? groupData.members : [];
    } else {
      const groupSnap = await adminDb.collection("groups").doc(groupId).get();
      if (!groupSnap.exists) {
        console.warn("[Notification] notifyGroupMembers: group not found", { groupId, type: payload.type });
        return;
      }
      members = Array.isArray(groupSnap.data()!.members) ? groupSnap.data()!.members : [];
    }

    if (members.length === 0) {
      console.warn("[Notification] No members in group", { groupId, type: payload.type });
      return;
    }

    const results = await Promise.allSettled(
      members.map((m) => resolveMemberProfileId(m))
    );
    const profileIds = new Set<string>();
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        profileIds.add(r.value);
      }
    }

    console.log("[Notification] resolved recipients", { count: profileIds.size, groupId, type: payload.type });
    if (profileIds.size === 0) {
      console.error("[Notification] NO RECIPIENTS RESOLVED", { groupId, type: payload.type });
      return;
    }

    let batch = adminDb.batch();
    let opCount = 0;

    for (const pid of profileIds) {
      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
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
    }

    if (opCount > 0) {
      console.log("[Notification] batch commit", { notificationCount: opCount, groupId, type: payload.type });
      await batch.commit();
      console.log("[Notification] batch commit success", { notificationCount: opCount, groupId, type: payload.type });
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
  if (profileIds.length === 0) {
    console.warn("[Notification] notifySpecificMembers: no profileIds provided", { type: payload.type });
    return;
  }

  try {
    const uniqueIds = [...new Set(profileIds)];
    console.log("[Notification] notifySpecificMembers recipients", { count: uniqueIds.length, type: payload.type });

    let batch = adminDb.batch();
    let opCount = 0;

    for (const pid of uniqueIds) {
      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
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
      opCount++;
    }

    if (opCount > 0) {
      console.log("[Notification] batch commit", { notificationCount: uniqueIds.length, type: payload.type });
      await batch.commit();
      console.log("[Notification] batch commit success", { notificationCount: uniqueIds.length, type: payload.type });
    }
  } catch (err) {
    console.error("[Notification] notifySpecificMembers failed", {
      profileIds,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


