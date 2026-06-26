import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp, resolveProfileId } from "@/lib/server/firebase-admin";
import { toMillis } from "@/lib/timestamp";

function mapNotification(id: string, data: Record<string, unknown>) {
  return {
    id,
    type: data.type as string,
    groupId: data.groupId as string,
    groupName: data.groupName as string,
    message: data.message as string,
    read: Boolean(data.read),
    createdAt: toMillis(data.createdAt),
    actorName: (data.actorName as string) ?? "",
  };
}

async function assertProfileOwnership(walletAddress: string, requestedProfileId: string): Promise<void> {
  const resolved = await resolveProfileId(walletAddress);
  if (!resolved || resolved !== requestedProfileId) {
    throw Object.assign(
      new Error("Profile does not belong to the authenticated wallet."),
      { statusCode: 403 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    console.log("[Notifications API] GET wallet:", auth.walletAddress);
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const limitParam = searchParams.get("limit");

    if (!profileId) {
      return errorResponse("profileId query parameter is required.", 400);
    }

    console.log("[Notifications API] GET profileId:", profileId);
    await assertProfileOwnership(auth.walletAddress, profileId);

    const limitCount = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

    const notificationsSnap = await adminDb
      .collection("users").doc(profileId).collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    const unreadSnap = await adminDb
      .collection("users").doc(profileId).collection("notifications")
      .where("read", "==", false)
      .count()
      .get();

    const notifications = notificationsSnap.docs.map((d) =>
      mapNotification(d.id, d.data() as Record<string, unknown>)
    );

    console.debug("[Notification API] GET", {
      profileId,
      notificationCount: notifications.length,
    });
    console.debug("[Notification API] unread count", {
      profileId,
      unreadCount: unreadSnap.data().count,
    });

    return okResponse({
      notifications,
      unreadCount: unreadSnap.data().count,
    });
  } catch (error) {
    console.error("[Notifications API] GET error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleError(error, "notifications.GET");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    console.log("[Notifications API] POST wallet:", auth.walletAddress);
    const body = await request.json();
    const { action, profileId, notificationId } = body as {
      action: string;
      profileId: string;
      notificationId?: string;
    };

    console.log("[Notifications API] POST action:", action, "profileId:", profileId, "notificationId:", notificationId);

    if (!profileId) {
      return errorResponse("profileId is required.", 400);
    }

    await assertProfileOwnership(auth.walletAddress, profileId);

    const col = adminDb.collection("users").doc(profileId).collection("notifications");

    if (action === "mark-read") {
      if (!notificationId) {
        return errorResponse("notificationId is required for mark-read.", 400);
      }
      await col.doc(notificationId).update({ read: true });
      console.log("[Notifications API] POST mark-read success:", notificationId);
      return okResponse({ success: true });
    }

    if (action === "mark-all-read") {
      const snap = await col.where("read", "==", false).get();
      if (snap.size === 0) {
        console.log("[Notifications API] POST mark-all-read: none unread");
        return okResponse({ success: true });
      }
      const batch = adminDb.batch();
      snap.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
      console.log("[Notifications API] POST mark-all-read success:", snap.size, "marked");
      return okResponse({ success: true });
    }

    return errorResponse("Invalid action. Supported: mark-read, mark-all-read", 400);
  } catch (error) {
    console.error("[Notifications API] POST error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleError(error, "notifications.POST");
  }
}
