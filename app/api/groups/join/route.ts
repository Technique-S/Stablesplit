import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";

const joinSchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(100).transform((s) => s.trim()),
  walletAddress: z.string().optional(),
  includeInUnsettled: z.boolean().optional(),
  profileId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    const body = await request.json();
    const parsed = joinSchema.parse(body);

    const walletTrimmed = (parsed.walletAddress ?? "").trim();

    const snap = await adminDb.collection("groups")
      .where("inviteCode", "==", parsed.inviteCode)
      .get();

    const matching = snap.docs.filter((d) => d.data().inviteCode === parsed.inviteCode);

    if (matching.length === 0) {
      return errorResponse("Invalid invite code.", 404);
    }

    const groupDoc = matching[0];
    const groupId = groupDoc.id;
    const group = groupDoc.data()!;

    const existingMembers: Array<Record<string, unknown>> = Array.isArray(group.members) ? group.members : [];
    const displayNameLower = parsed.displayName.toLowerCase();
    const alreadyMember = existingMembers.some((m) => String(m.displayName ?? "").toLowerCase() === displayNameLower);
    if (alreadyMember) {
      return okResponse({ groupId, groupName: group.name, alreadyMember: true });
    }

    let resolvedDisplayName = parsed.displayName;
    let resolvedWallet = walletTrimmed;

    if (parsed.profileId) {
      const profileSnap = await adminDb.collection("users").doc(parsed.profileId).get();
      if (profileSnap.exists) {
        const profileData = profileSnap.data()!;
        resolvedDisplayName = String(profileData.displayName ?? resolvedDisplayName);
        resolvedWallet = String(profileData.walletAddress ?? resolvedWallet).trim() || resolvedWallet;
      }
    }

    const newMember: Record<string, unknown> = {
      id: `member-${crypto.randomUUID()}`,
      displayName: resolvedDisplayName,
      walletAddress: resolvedWallet || undefined,
      avatarColor: undefined,
      createdAt: Date.now(),
      joinedAt: Date.now(),
      profileId: parsed.profileId || undefined,
    };

    const updatedMembers = [...existingMembers, newMember];

    const updatedWallets: Record<string, string> = {};
    for (const m of updatedMembers) {
      const w = String(m.walletAddress ?? "").trim();
      if (w) {
        updatedWallets[String(m.displayName)] = w;
        updatedWallets[String(m.id)] = w;
      }
    }

    const existingWallets = Object.values(group.memberWallets ?? {}) as string[];
    const updatedAddresses = [
      ...new Set([
        ...existingWallets.map((w: string) => w.trim().toLowerCase()),
        ...updatedMembers.map((m) => String(m.walletAddress ?? "").toLowerCase()).filter(Boolean),
      ]),
    ];

    await adminDb.collection("groups").doc(groupId).update({
      members: updatedMembers,
      memberWallets: updatedWallets,
      memberAddresses: updatedAddresses,
    });

    if (parsed.includeInUnsettled) {
      const expensesSnap = await adminDb.collection("groups").doc(groupId).collection("expenses").get();
      const unsettled = expensesSnap.docs.filter((d) => {
        const data = d.data();
        return !data.lockedAt && Array.isArray(data.splitAmong);
      });
      if (unsettled.length > 0) {
        const batch = adminDb.batch();
        for (const doc of unsettled) {
          const splitAmong = doc.data().splitAmong as string[];
          if (!splitAmong.includes(resolvedDisplayName)) {
            batch.update(doc.ref, { splitAmong: [...splitAmong, resolvedDisplayName] });
          }
        }
        await batch.commit();

        await adminDb.collection("groups").doc(groupId).collection("activity").add({
          groupId,
          eventType: "member.included_in_unsettled",
          actorName: resolvedDisplayName,
          description: `${resolvedDisplayName} was added to ${unsettled.length} unsettled expense(s).`,
          metadata: { memberId: newMember.id, memberName: resolvedDisplayName, unsettledCount: unsettled.length },
          createdAt: serverTimestamp(),
        });
      }
    }

    const groupName = String(group.name ?? "Group");

    await adminDb.collection("groups").doc(groupId).collection("activity").add({
      groupId,
      eventType: "member.joined_via_invite",
      actorName: resolvedDisplayName,
      description: `${resolvedDisplayName} joined the group via invite.`,
      metadata: { memberId: newMember.id, memberName: resolvedDisplayName, walletAddress: resolvedWallet || undefined },
      createdAt: serverTimestamp(),
    });

    if (resolvedWallet) {
      await adminDb.collection("groups").doc(groupId).collection("activity").add({
        groupId,
        eventType: "wallet.linked",
        actorName: resolvedDisplayName,
        description: `${resolvedDisplayName} linked a wallet while joining.`,
        metadata: { memberId: newMember.id, memberName: resolvedDisplayName, walletAddress: resolvedWallet },
        createdAt: serverTimestamp(),
      });
    }

    return okResponse({ groupId, groupName, alreadyMember: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
    }
    return handleError(error, "groups/join.POST");
  }
}
