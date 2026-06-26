import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/server/api-utils";
import { resolveProfileId } from "@/lib/server/firebase-admin";
import { createNotification } from "@/lib/server/notifications";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const { profileId } = body as { profileId?: string };

    if (!profileId) {
      return errorResponse("profileId is required.", 400);
    }

    const resolved = await resolveProfileId(auth.walletAddress);
    if (!resolved || resolved !== profileId) {
      return errorResponse("Profile does not belong to the authenticated wallet.", 403);
    }

    await createNotification(profileId, {
      type: NOTIFICATION_TYPES.TEST,
      title: "Test Notification",
      message: "Notification system operational",
    });

    return okResponse({ success: true });
  } catch (error) {
    return handleError(error, "notifications/test.POST");
  }
}
