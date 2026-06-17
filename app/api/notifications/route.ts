import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const createNotificationSchema = z.object({
  targets: z.array(z.object({
    profileId: z.string().min(1),
    type: z.string().min(1),
    groupId: z.string().min(1),
    groupName: z.string().optional(),
    message: z.string().min(1),
    actorName: z.string().optional(),
  })).min(1),
});

const markReadSchema = z.object({
  profileId: z.string().min(1),
  notificationId: z.string().optional(),
  markAll: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = createNotificationSchema.parse(body);

    const batch = adminDb.batch();

    for (const target of parsed.targets) {
      const ref = adminDb
        .collection("users")
        .doc(target.profileId)
        .collection("notifications")
        .doc();

      batch.set(ref, {
        type: target.type,
        groupId: target.groupId,
        groupName: target.groupName ?? target.groupId,
        message: target.message,
        read: false,
        createdAt: serverTimestamp(),
        actorName: target.actorName ?? auth.walletAddress,
      });
    }

    await batch.commit();
    return okResponse({ success: true }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "notifications.POST");
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    if (!profileId) {
      return errorResponse("profileId query parameter is required.", 400);
    }

    let query: FirebaseFirestore.Query = adminDb
      .collection("users")
      .doc(profileId)
      .collection("notifications")
      .orderBy("createdAt", "desc");

    if (unreadOnly) {
      query = query.where("read", "==", false);
    }

    const snap = await query.limit(limit).get();

    const notifications = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis() ?? Date.now(),
    }));

    const unreadQuery = await adminDb
      .collection("users")
      .doc(profileId)
      .collection("notifications")
      .where("read", "==", false)
      .count()
      .get();

    return okResponse({
      notifications,
      unreadCount: unreadQuery.data().count,
    });
  } catch (error) {
    return handleError(error, "notifications.GET");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = markReadSchema.parse(body);

    if (parsed.markAll) {
      const unread = await adminDb
        .collection("users")
        .doc(parsed.profileId)
        .collection("notifications")
        .where("read", "==", false)
        .limit(200)
        .get();

      if (unread.empty) return okResponse({ success: true });

      const batch = adminDb.batch();
      unread.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
    } else if (parsed.notificationId) {
      await adminDb
        .collection("users")
        .doc(parsed.profileId)
        .collection("notifications")
        .doc(parsed.notificationId)
        .update({ read: true });
    } else {
      return errorResponse("Provide notificationId or markAll: true.", 400);
    }

    return okResponse({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "notifications.PATCH");
  }
}
