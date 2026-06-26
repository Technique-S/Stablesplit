import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError, assertGroupMembership } from "@/lib/server/api-utils";
import { adminDb, serverTimestamp } from "@/lib/server/firebase-admin";
import { activitySchema } from "@/lib/domain/schemas";
import { toMillis } from "@/lib/timestamp";

function mapActivityResponse(doc: FirebaseFirestore.QueryDocumentSnapshot, groupId: string): Record<string, unknown> {
  const data = doc.data();
  return {
    id: doc.id,
    groupId: data.groupId ?? groupId,
    eventType: data.eventType ?? "unknown",
    actorName: data.actorName ?? "",
    description: data.description ?? "",
    metadata: data.metadata ?? {},
    createdAt: data.createdAt ? toMillis(data.createdAt) : Date.now(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    if (!groupId) {
      return errorResponse("groupId query parameter is required.", 400);
    }

    const groupSnap = await adminDb.collection("groups").doc(groupId).get();
    if (!groupSnap.exists) {
      return errorResponse("Group not found.", 404);
    }
    assertGroupMembership(groupSnap.data()!, auth.walletAddress);

    const snap = await adminDb
      .collection("groups").doc(groupId).collection("activity")
      .orderBy("createdAt", "desc").limit(200).get();

    const activity = snap.docs.map((d) => mapActivityResponse(d, groupId));

    return okResponse({ activity });
  } catch (error) {
    return handleError(error, "activity.GET");
  }
}

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
