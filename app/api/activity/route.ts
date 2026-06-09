import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const activitySchema = z.object({
  groupId: z.string().min(1),
  eventType: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  actorName: z.string().default("StableSplit"),
});

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
    const createdBy = String(groupData.createdBy ?? "").toLowerCase();
    const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];

    if (createdBy !== auth.walletAddress && !memberAddresses.includes(auth.walletAddress)) {
      return errorResponse("You are not a member of this group.", 403);
    }

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
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "activity.POST");
  }
}
