import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp } from "@/lib/server/firebase-admin";
import { activitySchema } from "@/lib/domain/schemas";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = activitySchema.parse(body);

    const groupSnap = await adminDb.collection("groups").doc(parsed.groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }

    const groupData = groupSnap.data()!;
    assertGroupMembership(groupData, auth.walletAddress);

    await adminDb.collection("groups").doc(parsed.groupId).collection("activity").add({
      groupId: parsed.groupId,
      eventType: parsed.eventType,
      actorName: parsed.actorName,
      description: parsed.description,
      metadata: parsed.metadata,
      createdAt: serverTimestamp(),
    });

    return okResponse({ success: true }, 201);
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "activity.POST");
  }
}
