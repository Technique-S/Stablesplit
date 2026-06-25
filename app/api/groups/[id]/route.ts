import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError, handleZodError } from "@/lib/api-utils";
import { adminDb, serverTimestamp } from "@/lib/firebase-admin";
import { updateGroupBaseSchema } from "@/lib/schemas";
import { toMillis } from "@/lib/timestamp";

async function getGroupOrThrow(groupId: string) {
  const snap = await adminDb.collection("groups").doc(groupId).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Group not found"), { statusCode: 404 });
  }
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

function memberKey(member: Record<string, unknown>): string {
  return String(member.id ?? String(member.displayName ?? "").toLowerCase());
}

async function addActivity(groupId: string, eventType: string, description: string, metadata: Record<string, unknown>, actorName = "StableSplit") {
  await adminDb.collection("groups").doc(groupId).collection("activity").add({
    groupId,
    eventType,
    actorName,
    description,
    metadata,
    createdAt: serverTimestamp(),
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const group = await getGroupOrThrow(id);

    const createdAt = toMillis(group.createdAt);
    const members = Array.isArray(group.members) ? group.members : [];
    const memberWallets = (group.memberWallets ?? {}) as Record<string, string>;

    return okResponse({
      id: group.id,
      name: group.name ?? "",
      description: group.description ?? "",
      members,
      memberWallets,
      currency: group.currency ?? "USD",
      createdAt,
      firstSettlementAt: group.firstSettlementAt ? toMillis(group.firstSettlementAt) : undefined,
      isDemo: group.isDemo ?? false,
      inviteCode: group.inviteCode ?? undefined,
      photoURL: group.photoURL ?? undefined,
      templateType: group.templateType ?? undefined,
      createdBy: group.createdBy ?? undefined,
    });
  } catch (error) {
    return handleError(error, "groups/[id].GET");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    const { id } = await params;
    const group = await getGroupOrThrow(id);

    if (group.createdBy && String(group.createdBy).toLowerCase() !== auth.walletAddress) {
      throw Object.assign(new Error("Only the group creator can update this group."), { statusCode: 403 });
    }

    const body = await request.json();

    if (body.operation === "addMember") {
      const member = body.member as Record<string, unknown>;
      if (!member || !member.displayName) {
        return errorResponse("Member must have a displayName.", 400);
      }
      const existingMembers = (Array.isArray(group.members) ? group.members : []) as Record<string, unknown>[];
      const nextMembers = [...existingMembers, {
        id: member.id ?? `member-${crypto.randomUUID()}`,
        displayName: String(member.displayName).trim(),
        walletAddress: member.walletAddress ? String(member.walletAddress).trim() : undefined,
        avatarColor: member.avatarColor ? String(member.avatarColor).trim() : undefined,
        createdAt: typeof member.createdAt === "number" ? member.createdAt : Date.now(),
        profileId: member.profileId ? String(member.profileId).trim() : undefined,
        role: member.role === "owner" || member.role === "member" ? member.role : undefined,
      }];

      const memberWallets = { ...(group.memberWallets ?? {}) } as Record<string, string>;
      const last = nextMembers[nextMembers.length - 1] as Record<string, unknown>;
      if (last.walletAddress) {
        memberWallets[String(last.displayName)] = String(last.walletAddress);
        memberWallets[String(last.id)] = String(last.walletAddress);
      }

      const memberAddresses = [
        ...new Set([
          ...nextMembers.map((m) => String(m.walletAddress ?? "").toLowerCase()).filter(Boolean),
        ]),
      ];

      await adminDb.collection("groups").doc(id).update({
        members: nextMembers,
        memberWallets,
        memberAddresses,
      });

      await addActivity(id, "member.added", `${last.displayName} was added to the group.`, {
        memberId: last.id,
        memberName: last.displayName,
      });

      return okResponse({ success: true });
    }

    if (body.operation === "updateWallet") {
      const { memberId, walletAddress } = body as { memberId: string; walletAddress: string };
      if (!memberId) return errorResponse("memberId is required.", 400);

      const existingMembers = (Array.isArray(group.members) ? group.members : []) as Record<string, unknown>[];
      const trimmedWallet = (walletAddress ?? "").trim();

      const updatedMembers = existingMembers.map((m) => {
        if (String(m.id) !== memberId) return m;
        return { ...m, walletAddress: trimmedWallet || undefined };
      });

      const memberWallets: Record<string, string> = {};
      for (const m of updatedMembers) {
        const w = String(m.walletAddress ?? "").trim();
        if (w) {
          memberWallets[String(m.displayName)] = w;
          memberWallets[String(m.id)] = w;
        }
      }

      await adminDb.collection("groups").doc(id).update({
        members: updatedMembers,
        memberWallets,
      });

      const previousWallet = existingMembers.find((m) => String(m.id) === memberId)?.walletAddress;
      const previousWalletStr = previousWallet ? String(previousWallet).trim() : "";
      const memberName = String(updatedMembers.find((m) => String(m.id) === memberId)?.displayName ?? "A member");
      const eventType = previousWalletStr ? "wallet.updated" : "wallet.linked";
      await addActivity(id, eventType as any,
        previousWalletStr ? `${memberName} updated their wallet.` : `${memberName} linked a wallet.`,
        { memberId, memberName, previousWallet: previousWalletStr, walletAddress: trimmedWallet },
        memberName
      );

      return okResponse({ success: true, members: updatedMembers, memberWallets });
    }

    const parsed = updateGroupBaseSchema.parse(body);

    const updatePayload: Record<string, unknown> = {};
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.description !== undefined) updatePayload.description = parsed.description;
    if (parsed.currency !== undefined) updatePayload.currency = parsed.currency;
    if (parsed.photoURL !== undefined) updatePayload.photoURL = parsed.photoURL;
    if (parsed.templateType !== undefined) updatePayload.templateType = parsed.templateType;

    if (parsed.members !== undefined) {
      const normalizedMembers = parsed.members.map((m) => ({
        id: m.id ?? `member-${crypto.randomUUID()}`,
        displayName: String(m.displayName ?? "").trim(),
        walletAddress: m.walletAddress ? String(m.walletAddress).trim() : undefined,
        avatarColor: m.avatarColor ? String(m.avatarColor).trim() : undefined,
        createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
        profileId: m.profileId ? String(m.profileId).trim() : undefined,
        role: m.role === "owner" || m.role === "member" ? m.role : undefined,
      }));

      const memberWallets: Record<string, string> = {};
      for (const m of normalizedMembers as Array<Record<string, unknown>>) {
        if (m.walletAddress) {
          memberWallets[String(m.displayName)] = String(m.walletAddress);
          memberWallets[String(m.id)] = String(m.walletAddress);
        }
      }

      updatePayload.members = normalizedMembers;
      updatePayload.memberWallets = { ...(parsed.memberWallets ?? {}), ...memberWallets };
    }

    if (Object.keys(updatePayload).length === 0) {
      return errorResponse("No fields to update.", 400);
    }

    const previous = group;
    await adminDb.collection("groups").doc(id).update(updatePayload);

    const prevName = String(previous.name ?? "");
    const newName = parsed.name ?? prevName;
    if (parsed.name !== undefined && prevName !== parsed.name) {
      await addActivity(id, "group.renamed", `Group renamed from ${prevName} to ${parsed.name}.`, {
        from: prevName, to: parsed.name,
      });
    }

    const prevDesc = String(previous.description ?? "");
    if (parsed.description !== undefined && prevDesc !== parsed.description) {
      await addActivity(id, "group.description_updated", "Group description was updated.", {
        from: prevDesc, to: parsed.description,
      });
    }

    const prevCur = String(previous.currency ?? "USD");
    if (parsed.currency !== undefined && prevCur !== parsed.currency) {
      await addActivity(id, "group.currency_changed", `Currency changed from ${prevCur} to ${parsed.currency}.`, {
        from: prevCur, to: parsed.currency,
      });
    }

    if (parsed.members !== undefined) {
      const oldMembers = (Array.isArray(previous.members) ? previous.members : []) as Record<string, unknown>[];
      const prevMap = new Map(oldMembers.map((m) => [memberKey(m), m]));
      const updatedMembersList = updatePayload.members as Record<string, unknown>[];
      const nextMap = new Map(updatedMembersList.map((m) => [memberKey(m), m]));

      for (const member of updatedMembersList) {
        const oldMember = prevMap.get(memberKey(member));
        if (!oldMember) {
          await addActivity(id, "member.added", `${member.displayName} was added to the group.`, {
            memberId: member.id, memberName: member.displayName,
          });
        }
      }
    }

    return okResponse({ success: true });
  } catch (error) {
    const zodRes = handleZodError(error);
    if (zodRes) return zodRes;
    return handleError(error, "groups/[id].PATCH");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    const { id } = await params;
    const group = await getGroupOrThrow(id);

    if (group.createdBy && String(group.createdBy).toLowerCase() !== auth.walletAddress) {
      throw Object.assign(new Error("Only the group creator can delete this group."), { statusCode: 403 });
    }

    const groupName = String(group.name ?? "Group");

    await adminDb.collection("groups").doc(id).collection("activity").add({
      groupId: id,
      eventType: "group.deleted",
      actorName: "StableSplit",
      description: `${groupName} was deleted.`,
      metadata: { groupName },
      createdAt: serverTimestamp(),
    });

    const nestedExpenses = await adminDb.collection("groups").doc(id).collection("expenses").get();
    const settlementPayments = await adminDb.collection("groups").doc(id).collection("settlementPayments").get();
    const legacyExpenses = await adminDb.collection("expenses").where("groupId", "==", id).get();
    const activityDocs = await adminDb.collection("groups").doc(id).collection("activity").get();

    const batch = adminDb.batch();
    activityDocs.forEach((d) => batch.delete(d.ref));
    nestedExpenses.forEach((d) => batch.delete(d.ref));
    settlementPayments.forEach((d) => batch.delete(d.ref));
    legacyExpenses.forEach((d) => batch.delete(d.ref));
    batch.delete(adminDb.collection("groups").doc(id));

    await batch.commit();
    return okResponse({ success: true });
  } catch (error) {
    return handleError(error, "groups/[id].DELETE");
  }
}
