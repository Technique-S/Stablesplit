import { apiRequest } from "./api-client";
import { AppNotification } from "../types";

function mapNotification(data: Record<string, unknown>): AppNotification {
  return {
    id: data.id as string,
    type: data.type as AppNotification["type"],
    groupId: data.groupId as string,
    groupName: data.groupName as string,
    message: data.message as string,
    read: Boolean(data.read),
    createdAt: data.createdAt as number,
    actorName: (data.actorName as string) ?? "",
  };
}

export async function getNotifications(profileId: string, limitCount = 50, walletAddress?: string): Promise<AppNotification[]> {
  if (!profileId) return [];
  try {
    const data = await apiRequest<{ notifications: Array<Record<string, unknown>> }>(
      "GET",
      `/api/notifications?profileId=${encodeURIComponent(profileId)}&limit=${limitCount}`,
      undefined,
      walletAddress
    );
    return (data.notifications ?? []).map(mapNotification);
  } catch (e) {
    console.error("[Notifications] Failed to fetch notifications.", {
      profileId,
      walletAddress,
      error: e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return [];
  }
}

export async function getUnreadCount(profileId: string, walletAddress?: string): Promise<number> {
  if (!profileId) return 0;
  try {
    const data = await apiRequest<{ unreadCount: number }>(
      "GET",
      `/api/notifications?profileId=${encodeURIComponent(profileId)}&limit=1`,
      undefined,
      walletAddress
    );
    return data.unreadCount ?? 0;
  } catch (e) {
    console.error("[Notifications] Failed to count unread.", {
      profileId,
      walletAddress,
      error: e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return 0;
  }
}

export async function markNotificationAsRead(profileId: string, notificationId: string, walletAddress?: string): Promise<void> {
  if (!profileId || !notificationId) return;
  try {
    await apiRequest("POST", "/api/notifications", {
      action: "mark-read",
      profileId,
      notificationId,
    }, walletAddress);
  } catch (e) {
    console.error("[Notifications] Failed to mark as read.", {
      profileId,
      notificationId,
      walletAddress,
      error: e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return;
  }
}

export async function markAllNotificationsAsRead(profileId: string, walletAddress?: string): Promise<void> {
  if (!profileId) return;
  try {
    await apiRequest("POST", "/api/notifications", {
      action: "mark-all-read",
      profileId,
    }, walletAddress);
  } catch (e) {
    console.error("[Notifications] Failed to mark all as read.", {
      profileId,
      walletAddress,
      error: e,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return;
  }
}
