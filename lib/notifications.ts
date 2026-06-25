import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { ActivityEventType, AppNotification, Member } from "./types";
import { toMillis } from "./timestamp";

function mapNotification(id: string, data: Record<string, unknown>): AppNotification {
  return {
    id,
    type: data.type as ActivityEventType,
    groupId: data.groupId as string,
    groupName: data.groupName as string,
    message: data.message as string,
    read: Boolean(data.read),
    createdAt: toMillis(data.createdAt),
    actorName: (data.actorName as string) ?? "",
  };
}

async function getGroupMembers(groupId: string): Promise<Member[]> {
  try {
    const snap = await getDoc(doc(db, "groups", groupId));
    if (!snap.exists()) return [];
    const data = snap.data();
    const members = data.members ?? [];
    return Array.isArray(members)
      ? members.map((m: Record<string, unknown>) => ({
          id: String(m.id ?? ""),
          displayName: String(m.displayName ?? ""),
          walletAddress: m.walletAddress as string | undefined,
          avatarColor: m.avatarColor as string | undefined,
          createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
          profileId: m.profileId as string | undefined,
        }))
      : [];
  } catch {
    return [];
  }
}

export async function notifyGroupMembers(
  groupId: string,
  type: ActivityEventType,
  message: string,
  actorName: string,
  excludeDisplayNames: string[] = [],
  groupName?: string
): Promise<void> {
  try {
    const members = await getGroupMembers(groupId);
    const name = groupName ?? members[0]?.displayName ?? groupId;

    const targets = members.filter(
      (m) => m.profileId && !excludeDisplayNames.includes(m.displayName)
    );

    if (targets.length === 0) return;

    const batch = writeBatch(db);
    const now = serverTimestamp();

    for (const member of targets) {
      const ref = doc(collection(db, "users", member.profileId!, "notifications"));
      batch.set(ref, {
        type,
        groupId,
        groupName: name,
        message,
        read: false,
        createdAt: now,
        actorName,
      });
    }

    await batch.commit();
  } catch (e) {
    console.error("[Notifications] Failed to notify group members.", { groupId, type, error: e });
  }
}

export async function notifySpecificMembers(
  groupId: string,
  type: ActivityEventType,
  message: string,
  actorName: string,
  targetProfileIds: string[],
  groupName?: string
): Promise<void> {
  if (!targetProfileIds.length) return;
  try {
    const name = groupName ?? groupId;
    const batch = writeBatch(db);
    const now = serverTimestamp();

    for (const profileId of targetProfileIds) {
      const ref = doc(collection(db, "users", profileId, "notifications"));
      batch.set(ref, {
        type,
        groupId,
        groupName: name,
        message,
        read: false,
        createdAt: now,
        actorName,
      });
    }

    await batch.commit();
  } catch (e) {
    console.error("[Notifications] Failed to notify specific members.", { groupId, type, error: e });
  }
}

export async function getNotifications(profileId: string, limitCount = 50): Promise<AppNotification[]> {
  if (!profileId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "users", profileId, "notifications"),
        orderBy("createdAt", "desc"),
        ...(limitCount > 0 ? [] : [])
      )
    );
    const results = snap.docs.map((d) => mapNotification(d.id, d.data() as Record<string, unknown>));
    return results.slice(0, limitCount);
  } catch (e) {
    console.error("[Notifications] Failed to fetch notifications.", { profileId, error: e });
    return [];
  }
}

export async function getUnreadCount(profileId: string): Promise<number> {
  if (!profileId) return 0;
  try {
    const snap = await getDocs(
      query(
        collection(db, "users", profileId, "notifications"),
        where("read", "==", false)
      )
    );
    return snap.size;
  } catch (e) {
    console.error("[Notifications] Failed to count unread.", { profileId, error: e });
    return 0;
  }
}

async function getUnreadNotifications(profileId: string, limitCount = 50): Promise<AppNotification[]> {
  if (!profileId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, "users", profileId, "notifications"),
        where("read", "==", false),
        orderBy("createdAt", "desc")
      )
    );
    return snap.docs.map((d) => mapNotification(d.id, d.data() as Record<string, unknown>)).slice(0, limitCount);
  } catch (e) {
    console.error("[Notifications] Failed to fetch unread notifications.", { profileId, error: e });
    return [];
  }
}

export async function markNotificationAsRead(profileId: string, notificationId: string): Promise<void> {
  if (!profileId) return;
  try {
    await updateDoc(doc(db, "users", profileId, "notifications", notificationId), { read: true });
  } catch (e) {
    console.error("[Notifications] Failed to mark as read.", { profileId, notificationId, error: e });
  }
}

export async function markAllNotificationsAsRead(profileId: string): Promise<void> {
  if (!profileId) return;
  try {
    const unread = await getUnreadNotifications(profileId, 200);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, "users", profileId, "notifications", n.id), { read: true });
    }
    await batch.commit();
  } catch (e) {
    console.error("[Notifications] Failed to mark all as read.", { profileId, error: e });
  }
}