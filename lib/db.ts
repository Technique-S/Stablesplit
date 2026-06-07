import {
  collection,
  deleteDoc,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Group,
  Expense,
  ExpenseInput,
  ExpenseCategory,
  GroupInput,
  SettlementPayment,
  SettlementPaymentStatus,
  SettlementToken,
  Member,
  ActivityEventType,
  ActivityRecord,
} from "./types";
import { MemberRecord, memberWalletMap, normalizeMembers, createMember } from "./members";
import { notifyGroupMembers, notifySpecificMembers } from "./notifications";

function logFirestoreError(operation: string, context: Record<string, unknown>, error: unknown): void {
  console.error(`[Firestore:${operation}]`, {
    context,
    error,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function mapGroup(snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Group {
  const data = snap.data() ?? {};
  const createdAt = toMillis(data.createdAt);
  const members = normalizeMembers(data.members, data.memberWallets ?? {}, createdAt);
  return {
    id: snap.id,
    name: data.name ?? "",
    description: data.description ?? "",
    members,
    memberWallets: { ...(data.memberWallets ?? {}), ...memberWalletMap(members) },
    currency: data.currency ?? "USD",
    createdAt,
    firstSettlementAt: data.firstSettlementAt ? toMillis(data.firstSettlementAt) : undefined,
    isDemo: data.isDemo ?? false,
    inviteCode: data.inviteCode ?? undefined,
    photoURL: data.photoURL ?? undefined,
    templateType: data.templateType ?? undefined,
    createdBy: data.createdBy ?? undefined,
  };
}

function serializeMembersForFirestore(members: Member[]): Array<Record<string, string | number>> {
  return members.map((member) => {
    const payload: Record<string, string | number> = {
      id: member.id,
      displayName: member.displayName,
      createdAt: member.createdAt,
    };

    if (member.walletAddress?.trim()) {
      payload.walletAddress = member.walletAddress.trim();
    }

    if (member.avatarColor?.trim()) {
      payload.avatarColor = member.avatarColor.trim();
    }

    if (member.profileId?.trim()) {
      payload.profileId = member.profileId.trim();
    }

    if (member.role) {
      payload.role = member.role;
    }

    return payload;
  });
}

export function mapExpense(
  snap: QueryDocumentSnapshot<DocumentData>,
  fallbackGroupId: string
): Expense {
  const data = snap.data();
  return {
    id: snap.id,
    groupId: data.groupId ?? fallbackGroupId,
    description: data.description ?? "",
    amount: Number(data.amount ?? 0),
    paidBy: data.paidBy ?? "",
    splitAmong: Array.isArray(data.splitAmong) ? data.splitAmong : [],
    category: (data.category ?? "other") as ExpenseCategory,
    createdAt: toMillis(data.createdAt),
    date: toMillis(data.date ?? data.createdAt),
    notes: data.notes ?? "",
    lockedAt: data.lockedAt ? toMillis(data.lockedAt) : undefined,
    recurrence: data.recurrence
      ? {
          frequency: data.recurrence.frequency,
          nextDate: toMillis(data.recurrence.nextDate),
          isPaused: data.recurrence.isPaused ?? false,
        }
      : undefined,
    recurrenceParentId: data.recurrenceParentId ?? undefined,
    originalCurrency: data.originalCurrency ?? undefined,
    baseUsdAmount: data.baseUsdAmount ? Number(data.baseUsdAmount) : undefined,
    baseEurAmount: data.baseEurAmount ? Number(data.baseEurAmount) : undefined,
    fxRate: data.fxRate ? Number(data.fxRate) : undefined,
  };
}

export function mapSettlementPayment(snap: QueryDocumentSnapshot<DocumentData>): SettlementPayment {
  const data = snap.data();
  const status = (data.settlementStatus ?? data.status ?? "pending") as SettlementPaymentStatus;
  const currency = (data.settlementTokenUsed ?? data.currency ?? "USDC") as SettlementToken;
  const amount = Number(data.amount ?? 0);
  const settlementKey = data.from && data.to && Number.isFinite(amount)
    ? encodeURIComponent(`${data.from}__${data.to}__${amount.toFixed(2)}`)
    : data.settlementKey ?? snap.id;
  return {
    id: snap.id,
    groupId: data.groupId ?? "",
    settlementKey,
    from: data.from ?? "",
    to: data.to ?? "",
    payerWallet: data.payerWallet ?? "",
    receiverWallet: data.receiverWallet ?? "",
    amount,
    currency,
    settlementTokenUsed: currency,
    status,
    settlementStatus: status,
    batchId: data.batchId ?? undefined,
    txHash: data.txHash ?? "",
    settledAt: data.settledAt ? toMillis(data.settledAt) : undefined,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt ?? data.createdAt),
  };
}

export function mapActivityRecord(
  snap: QueryDocumentSnapshot<DocumentData>,
  fallbackGroupId: string
): ActivityRecord {
  const data = snap.data();
  return {
    id: snap.id,
    groupId: data.groupId ?? fallbackGroupId,
    eventType: (data.eventType ?? "group.description_updated") as ActivityEventType,
    actorName: data.actorName ?? "StableSplit",
    description: data.description ?? "",
    metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
    createdAt: toMillis(data.createdAt),
  };
}

export async function addActivityRecord(
  groupId: string,
  eventType: ActivityEventType,
  description: string,
  metadata: Record<string, unknown> = {},
  actorName = "StableSplit"
): Promise<void> {
  try {
    await addDoc(collection(db, "groups", groupId, "activity"), {
      groupId,
      eventType,
      actorName,
      description,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreError("addActivityRecord", { groupId, eventType }, error);
  }
}

function memberKey(member: Member): string {
  return member.id || member.displayName.toLowerCase();
}

function needsMemberMigration(data: DocumentData): boolean {
  if (!Array.isArray(data.members)) return true;
  return data.members.some((member: unknown) => {
    if (typeof member === "string") return true;
    if (!member || typeof member !== "object") return true;
    const value = member as Record<string, unknown>;
    return !value.id || !value.displayName || typeof value.createdAt !== "number";
  });
}

async function migrateLegacyMembersIfNeeded(groupId: string, group: Group, data: DocumentData): Promise<void> {
  if (!needsMemberMigration(data)) return;

  try {
    await setDoc(
      doc(db, "groups", groupId),
      {
        members: serializeMembersForFirestore(group.members),
        memberWallets: group.memberWallets ?? {},
      },
      { merge: true }
    );
    console.info("[Firestore:getGroup] Migrated legacy members.", {
      groupId,
      memberCount: group.members.length,
    });
  } catch (error) {
    logFirestoreError("getGroup.migrateLegacyMembers", { groupId }, error);
  }
}

// Groups
function generateInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const values = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    code += chars[values[i] % chars.length];
  }
  return code;
}

export async function createGroup(
  name: string,
  description: string,
  members: MemberRecord[],
  currency: string,
  memberWallets: Record<string, string> = {},
  templateType?: string,
  profileId?: string,
  createdBy?: string
): Promise<string> {
  try {
    const normalizedMembers = normalizeMembers(members, memberWallets);
    if (profileId && normalizedMembers.length > 0) {
      normalizedMembers[0] = {
        ...normalizedMembers[0],
        profileId,
        role: "owner" as const,
      };
    }
    const inviteCode = generateInviteCode();
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      members: serializeMembersForFirestore(normalizedMembers),
      memberWallets: memberWalletMap(normalizedMembers),
      currency,
      inviteCode,
      createdAt: serverTimestamp(),
      ...(templateType ? { templateType } : {}),
      ...(createdBy ? { createdBy } : {}),
    };

    console.info("[Firestore:createGroup] Creating group.", {
      collection: "groups",
      memberCount: normalizedMembers.length,
      hasWallets: Object.keys((payload.memberWallets ?? {}) as Record<string, string>).length > 0,
    });

    const ref = await addDoc(collection(db, "groups"), payload);
    await addActivityRecord(ref.id, "group.created", `${payload.name} was created.`, {
      groupName: payload.name,
      currency,
      memberCount: normalizedMembers.length,
    });
    await addActivityRecord(ref.id, "invite.generated", `Invite link created for ${payload.name}.`, {
      inviteCode,
    });
    console.info("[Firestore:createGroup] Group created.", { groupId: ref.id });
    return ref.id;
  } catch (error) {
    logFirestoreError("createGroup", {
      collection: "groups",
      memberCount: Array.isArray(members) ? members.length : 0,
    }, error);
    throw error;
  }
}

export async function uploadGroupImage(groupId: string, file: Blob): Promise<string> {
  const storageRef = ref(storage, `groups/${groupId}/avatar.jpg`);
  const snapshot = await uploadBytes(storageRef, file);
  const photoURL = await getDownloadURL(snapshot.ref);
  await updateDoc(doc(db, "groups", groupId), { photoURL });
  return photoURL;
}

export async function getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
  try {
    const snap = await getDocs(
      query(collection(db, "groups"), where("inviteCode", "==", inviteCode))
    );
    if (snap.empty) return null;
    return mapGroup(snap.docs[0]);
  } catch (error) {
    logFirestoreError("getGroupByInviteCode", { inviteCode }, error);
    return null;
  }
}

export async function joinGroupByInvite(
  inviteCode: string,
  displayName: string,
  walletAddress?: string,
  includeInUnsettled?: boolean,
  profileId?: string
): Promise<{ groupId: string; groupName: string }> {
  const group = await getGroupByInviteCode(inviteCode);
  if (!group) throw new Error("Invalid or expired invite link.");

  const nameLower = displayName.trim().toLowerCase();
  const walletTrimmed = walletAddress?.trim() ?? "";

  for (const member of group.members) {
    if (member.displayName.toLowerCase() === nameLower) {
      throw new Error("A member with that name already exists in this group.");
    }
    if (walletTrimmed && member.walletAddress?.toLowerCase() === walletTrimmed.toLowerCase()) {
      throw new Error("A member with that wallet address already exists in this group.");
    }
  }

  const newMember = createMember(displayName.trim(), walletTrimmed, undefined, Date.now());
  if (profileId) newMember.profileId = profileId;
  const updatedMembers = [...group.members, newMember];
  const updatedWallets = { ...(group.memberWallets ?? {}), ...memberWalletMap(updatedMembers) };

  await updateDoc(doc(db, "groups", group.id), {
    members: serializeMembersForFirestore(updatedMembers),
    memberWallets: updatedWallets,
  });

  let modifiedExpenseCount = 0;

  if (includeInUnsettled) {
    try {
      const allExpenses = await getExpenses(group.id);
      const unsettledExpenses = allExpenses.filter((exp) => !exp.lockedAt);

      for (const expense of unsettledExpenses) {
        if (expense.splitAmong.includes(displayName.trim())) continue;

        const updatedSplitAmong = [...expense.splitAmong, displayName.trim()];
        const ref = await getExpenseRef(group.id, expense.id);
        await updateDoc(ref, { splitAmong: updatedSplitAmong });
        modifiedExpenseCount++;
      }
    } catch (error) {
      logFirestoreError("joinGroupByInvite.expenses", { groupId: group.id, displayName }, error);
    }
  }

  if (modifiedExpenseCount > 0) {
    await addActivityRecord(
      group.id,
      "member.joined_via_invite",
      `${displayName.trim()} joined the group and was added to ${modifiedExpenseCount} unsettled expense${modifiedExpenseCount !== 1 ? "s" : ""}.`,
      {
        memberId: newMember.id,
        memberName: displayName.trim(),
        walletAddress: walletTrimmed || undefined,
        modifiedExpenseCount,
      }
    );
  } else {
    await addActivityRecord(
      group.id,
      "member.joined_via_invite",
      `${displayName.trim()} joined the group via invite.`,
      {
        memberId: newMember.id,
        memberName: displayName.trim(),
        walletAddress: walletTrimmed || undefined,
      }
    );
  }

  if (walletTrimmed) {
    await addActivityRecord(group.id, "wallet.linked", `${displayName.trim()} linked a wallet while joining.`, {
      memberId: newMember.id,
      memberName: displayName.trim(),
      walletAddress: walletTrimmed,
    }, displayName.trim());
  }

  await notifyGroupMembers(
    group.id,
    "member.joined_via_invite",
    `${displayName.trim()} joined the group.`,
    displayName.trim(),
    [displayName.trim()],
    group.name
  );

  return { groupId: group.id, groupName: group.name };
}

export async function getGroup(id: string): Promise<Group | null> {
  try {
    console.info("[Firestore:getGroup] Loading group.", {
      collection: "groups",
      groupId: id,
    });
    const snap = await getDoc(doc(db, "groups", id));
    if (!snap.exists()) {
      console.info("[Firestore:getGroup] Group not found.", { groupId: id });
      return null;
    }

    const group = mapGroup(snap);
    const data = snap.data() ?? {};
    void migrateLegacyMembersIfNeeded(id, group, data);
    return group;
  } catch (error) {
    logFirestoreError("getGroup", {
      collection: "groups",
      groupId: id,
    }, error);
    throw error;
  }
}

export async function getAllGroups(): Promise<Group[]> {
  try {
    const snap = await getDocs(collection(db, "groups"));
    return snap.docs.map(mapGroup).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logFirestoreError("getAllGroups", {
      collection: "groups",
      compositeIndexRequired: false,
    }, error);
    return [];
  }
}

export async function getGroupsByIds(ids: string[]): Promise<Group[]> {
  if (!ids.length) return [];
  try {
    const groups: Group[] = [];
    for (let i = 0; i < ids.length; i += 30) {
      const batch = ids.slice(i, i + 30);
      const snap = await getDocs(
        query(collection(db, "groups"), where("__name__", "in", batch))
      );
      for (const docSnap of snap.docs) {
        groups.push(mapGroup(docSnap));
      }
    }
    return groups.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logFirestoreError("getGroupsByIds", { count: ids.length }, error);
    return [];
  }
}

export async function addMemberToGroup(
  groupId: string,
  member: MemberRecord
): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  const nextMembers = normalizeMembers([...group.members, member], group.memberWallets, group.createdAt);
  await updateDoc(doc(db, "groups", groupId), {
    members: serializeMembersForFirestore(nextMembers),
    memberWallets: memberWalletMap(nextMembers),
  });
}

export async function updateGroup(
  groupId: string,
  input: GroupInput
): Promise<void> {
  const previous = await getGroup(groupId);
  const members = normalizeMembers(input.members, input.memberWallets);
  const updatePayload: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    currency: input.currency,
    members: serializeMembersForFirestore(members),
    memberWallets: { ...(input.memberWallets ?? {}), ...memberWalletMap(members) },
  };
  if (input.photoURL !== undefined) updatePayload.photoURL = input.photoURL;
  if (input.templateType !== undefined) updatePayload.templateType = input.templateType;
  await updateDoc(doc(db, "groups", groupId), updatePayload);

  if (!previous) return;

  const previousMembers = new Map(previous.members.map((member) => [memberKey(member), member]));
  const nextMembers = new Map(members.map((member) => [memberKey(member), member]));

  if (previous.name !== input.name) {
    await addActivityRecord(groupId, "group.renamed", `Group renamed from ${previous.name} to ${input.name}.`, {
      from: previous.name,
      to: input.name,
    });
  }

  if ((previous.description ?? "") !== input.description) {
    await addActivityRecord(groupId, "group.description_updated", "Group description was updated.", {
      from: previous.description ?? "",
      to: input.description,
    });
  }

  if (previous.currency !== input.currency) {
    await addActivityRecord(groupId, "group.currency_changed", `Currency changed from ${previous.currency} to ${input.currency}.`, {
      from: previous.currency,
      to: input.currency,
    });
  }

  for (const member of members) {
    const oldMember = previousMembers.get(memberKey(member));
    if (!oldMember) {
      await addActivityRecord(groupId, "member.added", `${member.displayName} was added to the group.`, {
        memberId: member.id,
        memberName: member.displayName,
      });
      continue;
    }

    const oldWallet = oldMember.walletAddress?.trim() ?? "";
    const nextWallet = member.walletAddress?.trim() ?? "";
    if (!oldWallet && nextWallet) {
      await addActivityRecord(groupId, "wallet.linked", `${member.displayName} linked a wallet.`, {
        memberId: member.id,
        memberName: member.displayName,
        walletAddress: nextWallet,
      }, member.displayName);
    } else if (oldWallet && nextWallet && oldWallet.toLowerCase() !== nextWallet.toLowerCase()) {
      await addActivityRecord(groupId, "wallet.updated", `${member.displayName} updated their wallet.`, {
        memberId: member.id,
        memberName: member.displayName,
        previousWallet: oldWallet,
        walletAddress: nextWallet,
      }, member.displayName);
    }
  }

  for (const member of previous.members) {
    if (!nextMembers.has(memberKey(member))) {
      await addActivityRecord(groupId, "member.removed", `${member.displayName} was removed from the group.`, {
        memberId: member.id,
        memberName: member.displayName,
      });
    }
  }

  const changes: string[] = [];
  if (previous.name !== input.name) changes.push(`renamed to "${input.name}"`);
  if ((previous.description ?? "") !== input.description) changes.push("description updated");
  if (previous.currency !== input.currency) changes.push(`currency changed to ${input.currency}`);
  if (changes.length > 0) {
    await notifyGroupMembers(
      groupId,
      "group.renamed",
      `Group ${changes.join(", ")}.`,
      "StableSplit",
      [],
      input.name
    );
  }

  for (const member of members) {
    const oldMember = previousMembers.get(memberKey(member));
    if (!oldMember && member.profileId) {
      await notifyGroupMembers(
        groupId,
        "member.added",
        `${member.displayName} was added to the group.`,
        "StableSplit",
        [member.displayName],
        input.name
      );
    }
  }
}

export async function updateMemberWallet(
  groupId: string,
  memberId: string,
  walletAddress: string
): Promise<Group | null> {
  try {
    console.info("[Firestore:updateMemberWallet] Updating member wallet.", {
      collection: "groups",
      groupId,
      memberId,
      hasWallet: Boolean(walletAddress.trim()),
    });

    const group = await getGroup(groupId);
    if (!group) return null;

    const trimmedWallet = walletAddress.trim();
    const members = group.members.map((member) => {
      if (member.id !== memberId) return member;
      return {
        ...member,
        walletAddress: trimmedWallet || undefined,
      };
    });

    const nextGroup = {
      ...group,
      members,
      memberWallets: memberWalletMap(members),
    };

    await updateDoc(doc(db, "groups", groupId), {
      members: serializeMembersForFirestore(members),
      memberWallets: nextGroup.memberWallets,
    });

    const previousWallet = group.members.find((member) => member.id === memberId)?.walletAddress?.trim() ?? "";
    if (previousWallet.toLowerCase() === trimmedWallet.toLowerCase()) {
      console.info("[Firestore:updateMemberWallet] Member wallet unchanged.", {
        groupId,
        memberId,
      });
      return nextGroup;
    }

    const eventType: ActivityEventType = previousWallet ? "wallet.updated" : "wallet.linked";
    const memberName = members.find((member) => member.id === memberId)?.displayName ?? "A member";
    await addActivityRecord(
      groupId,
      eventType,
      previousWallet ? `${memberName} updated their wallet.` : `${memberName} linked a wallet.`,
      {
        memberId,
        memberName,
        previousWallet,
        walletAddress: trimmedWallet,
      },
      memberName
    );

    console.info("[Firestore:updateMemberWallet] Member wallet updated.", {
      groupId,
      memberId,
    });

    return nextGroup;
  } catch (error) {
    logFirestoreError("updateMemberWallet", {
      collection: "groups",
      groupId,
      memberId,
    }, error);
    throw error;
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  const batch = writeBatch(db);
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  const groupName = groupSnap.data()?.name ?? "Group";

  await addActivityRecord(groupId, "group.deleted", `${groupName} was deleted.`, {
    groupName,
  });

  const nestedExpenses = await getDocs(collection(db, "groups", groupId, "expenses"));
  nestedExpenses.docs.forEach((expenseDoc) => batch.delete(expenseDoc.ref));

  const settlementPayments = await getDocs(collection(db, "groups", groupId, "settlementPayments"));
  settlementPayments.docs.forEach((paymentDoc) => batch.delete(paymentDoc.ref));

  const legacyExpenses = await getDocs(
    query(collection(db, "expenses"), where("groupId", "==", groupId))
  );
  legacyExpenses.docs.forEach((expenseDoc) => batch.delete(expenseDoc.ref));

  batch.delete(groupRef);
  await batch.commit();
}

// Expenses
export async function addExpense(
  groupId: string,
  description: string,
  amount: number,
  paidBy: string,
  splitAmong: string[],
  category: ExpenseCategory
): Promise<string> {
  return createExpense(groupId, {
    description,
    amount,
    paidBy,
    splitAmong,
    category,
  });
}

export async function createExpense(
  groupId: string,
  expense: ExpenseInput
): Promise<string> {
  const payload: Record<string, unknown> = {
    groupId,
    description: expense.description,
    amount: expense.amount,
    paidBy: expense.paidBy,
    splitAmong: expense.splitAmong,
    category: expense.category,
    date: expense.date ?? Date.now(),
    notes: expense.notes ?? "",
    createdAt: serverTimestamp(),
  };
  if (expense.recurrence) {
    payload.recurrence = {
      frequency: expense.recurrence.frequency,
      nextDate: expense.recurrence.nextDate,
      isPaused: expense.recurrence.isPaused,
    };
  }
  if (expense.originalCurrency) {
    payload.originalCurrency = expense.originalCurrency;
    payload.baseUsdAmount = expense.baseUsdAmount;
    payload.baseEurAmount = expense.baseEurAmount;
    payload.fxRate = expense.fxRate;
  }
  const ref = await addDoc(collection(db, "groups", groupId, "expenses"), payload);
  const activityMeta: Record<string, unknown> = {
    expenseId: ref.id,
    description: expense.description,
    amount: expense.amount,
    paidBy: expense.paidBy,
    splitAmong: expense.splitAmong,
    category: expense.category,
  };
  const activityDesc = expense.recurrence
    ? `${expense.description} was added (recurring ${expense.recurrence.frequency}).`
    : `${expense.description} was added.`;
  if (expense.recurrence) {
    activityMeta.isRecurring = true;
    activityMeta.recurrenceFrequency = expense.recurrence.frequency;
  }
  await addActivityRecord(groupId, "expense.created", activityDesc, activityMeta, expense.paidBy || "StableSplit");

  const notifyExclude = [expense.paidBy];
  try {
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    const groupData = groupSnap.data();
    const groupName = groupData?.name ?? "";
    await notifyGroupMembers(
      groupId,
      "expense.created",
      `${expense.paidBy} added "${expense.description}" (${expense.splitAmong.length}-way split).`,
      expense.paidBy || "StableSplit",
      notifyExclude,
      groupName
    );
  } catch {
    // notification fire-and-forget
  }

  return ref.id;
}

async function getExpenseRef(groupId: string, expenseId: string) {
  const nestedRef = doc(db, "groups", groupId, "expenses", expenseId);
  const nestedSnap = await getDoc(nestedRef);
  if (nestedSnap.exists()) return nestedRef;

  const legacyRef = doc(db, "expenses", expenseId);
  const legacySnap = await getDoc(legacyRef);
  if (legacySnap.exists()) return legacyRef;

  return nestedRef;
}

export async function deleteExpense(
  groupId: string,
  expenseId: string
): Promise<void> {
  const ref = await getExpenseRef(groupId, expenseId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().lockedAt) {
    throw new Error("This expense is locked because it predates a completed settlement.");
  }
  const data = snap.data();
  await deleteDoc(ref);
  await addActivityRecord(groupId, "expense.deleted", `${data?.description ?? "An expense"} was deleted.`, {
    expenseId,
    description: data?.description ?? "",
    amount: Number(data?.amount ?? 0),
    paidBy: data?.paidBy ?? "",
  });
}

export async function getExpenses(groupId: string): Promise<Expense[]> {
  let expenses: Expense[] = [];

  try {
    console.info("[Firestore:getExpenses] Loading nested expenses.", {
      collection: `groups/${groupId}/expenses`,
      groupId,
      orderBy: "client-side createdAt desc",
      compositeIndexRequired: false,
    });

    const groupExpensesSnap = await getDocs(collection(db, "groups", groupId, "expenses"));

    expenses = groupExpensesSnap.docs.map((d) => mapExpense(d, groupId));
  } catch (error) {
    logFirestoreError("getExpenses.nested", {
      collection: `groups/${groupId}/expenses`,
      groupId,
      orderBy: "client-side createdAt desc",
      compositeIndexRequired: false,
    }, error);
  }

  let legacyExpenses: Expense[] = [];
  try {
    console.info("[Firestore:getExpenses] Loading legacy expenses.", {
      collection: "expenses",
      groupId,
      where: "groupId ==",
      compositeIndexRequired: false,
    });

    const legacyExpensesSnap = await getDocs(
      query(
        collection(db, "expenses"),
        where("groupId", "==", groupId)
      )
    );

    legacyExpenses = legacyExpensesSnap.docs
      .filter((d) => !expenses.some((expense) => expense.id === d.id))
      .map((d) => mapExpense(d, groupId));
  } catch (error) {
    logFirestoreError("getExpenses.legacy", {
      collection: "expenses",
      groupId,
      where: "groupId ==",
      compositeIndexRequired: false,
    }, error);
  }

  const merged = [...expenses, ...legacyExpenses].sort((a, b) => b.createdAt - a.createdAt);
  console.info("[Firestore:getExpenses] Loaded expenses.", {
    groupId,
    nestedCount: expenses.length,
    legacyCount: legacyExpenses.length,
    totalCount: merged.length,
  });
  return merged;
}

export async function getSettlementPayments(groupId: string): Promise<SettlementPayment[]> {
  try {
    console.info("[Firestore:getSettlementPayments] Loading settlement payments.", {
      collection: `groups/${groupId}/settlementPayments`,
      groupId,
      compositeIndexRequired: false,
    });

    const snap = await getDocs(collection(db, "groups", groupId, "settlementPayments"));
    const paymentMap = new Map<string, SettlementPayment>();
    snap.docs.map(mapSettlementPayment).forEach((payment) => {
      const existing = paymentMap.get(payment.settlementKey);
      if (!existing) {
        paymentMap.set(payment.settlementKey, payment);
        return;
      }
      if (payment.status === "paid" || (existing.status !== "paid" && payment.updatedAt > existing.updatedAt)) {
        paymentMap.set(payment.settlementKey, payment);
      }
    });
    const payments = [...paymentMap.values()];
    console.info("[Firestore:getSettlementPayments] Loaded settlement payments.", {
      groupId,
      count: payments.length,
    });
    return payments;
  } catch (error) {
    logFirestoreError("getSettlementPayments", {
      collection: `groups/${groupId}/settlementPayments`,
      groupId,
      compositeIndexRequired: false,
    }, error);
    return [];
  }
}

export async function getGroupActivity(groupId: string): Promise<ActivityRecord[]> {
  try {
    console.info("[Firestore:getGroupActivity] Loading activity.", {
      collection: `groups/${groupId}/activity`,
      groupId,
      orderBy: "client-side createdAt desc",
      compositeIndexRequired: false,
    });

    const snap = await getDocs(collection(db, "groups", groupId, "activity"));
    return snap.docs
      .map((activityDoc) => mapActivityRecord(activityDoc, groupId))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    logFirestoreError("getGroupActivity", {
      collection: `groups/${groupId}/activity`,
      groupId,
      compositeIndexRequired: false,
    }, error);
    return [];
  }
}

export async function upsertSettlementPayment(
  groupId: string,
  payment: Omit<SettlementPayment, "id" | "groupId" | "createdAt" | "updatedAt"> & {
    createdAt?: number;
  }
): Promise<void> {
  const ref = doc(db, "groups", groupId, "settlementPayments", payment.settlementKey);
  const existing = await getDoc(ref);
  const existingData = existing.data();
  const existingStatus = existingData?.settlementStatus ?? existingData?.status;
  if (existingStatus === "paid") {
    return;
  }
  if (existingStatus === "pending" && payment.status === "pending") {
    throw new Error("This settlement is already pending.");
  }

  const paymentPayload = {
    ...payment,
    groupId,
    currency: payment.currency,
    settlementTokenUsed: payment.currency,
    status: payment.status,
    settlementStatus: payment.status,
    settledAt: payment.status === "paid" ? serverTimestamp() : existingData?.settledAt ?? null,
    createdAt: existing.exists() ? existingData?.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payment.status !== "paid") {
    await setDoc(ref, paymentPayload, { merge: true });

    const notifyMembersForSettlement = async () => {
      try {
        const gSnap = await getDoc(doc(db, "groups", groupId));
        const gData = gSnap.data() ?? {};
        const gName = gData.name ?? "";
        const gMembers: Array<Record<string, unknown>> = Array.isArray(gData.members) ? gData.members : [];
        const toProfileId = (gMembers.find((m: Record<string, unknown>) => m.displayName === payment.to)?.profileId as string) ?? "";
        if (toProfileId) {
          await notifySpecificMembers(
            groupId,
            payment.status === "pending" ? "settlement.initiated" : "settlement.failed",
            payment.status === "pending"
              ? `${payment.from} started a settlement of ${payment.currency} ${payment.amount.toFixed(2)} to you.`
              : `${payment.from}'s settlement of ${payment.currency} ${payment.amount.toFixed(2)} to you failed.`,
            payment.from,
            [toProfileId],
            gName
          );
        }
      } catch { /* ignore */ }
    };

    if (payment.status === "pending") {
      await addActivityRecord(groupId, "settlement.initiated", `${payment.from} started a settlement to ${payment.to}.`, {
        settlementKey: payment.settlementKey,
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        token: payment.currency,
      }, payment.from);
      void notifyMembersForSettlement();
    } else if (payment.status === "failed") {
      await addActivityRecord(groupId, "settlement.failed", `${payment.from}'s settlement to ${payment.to} failed.`, {
        settlementKey: payment.settlementKey,
        from: payment.from,
        to: payment.to,
        amount: payment.amount,
        token: payment.currency,
      }, payment.from);
      void notifyMembersForSettlement();
    }
    return;
  }

  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.data() ?? {};
  const settlementAt = Date.now();
  const batch = writeBatch(db);

  batch.set(ref, {
    ...paymentPayload,
    settledAt: settlementAt,
  }, { merge: true });

  batch.set(groupRef, {
    firstSettlementAt: groupData.firstSettlementAt ?? settlementAt,
  }, { merge: true });

  const nestedExpenses = await getDocs(collection(db, "groups", groupId, "expenses"));
  nestedExpenses.docs.forEach((expenseDoc) => {
    const data = expenseDoc.data();
    const createdAt = toMillis(data.createdAt);
    if (!data.lockedAt && createdAt <= settlementAt) {
      batch.set(expenseDoc.ref, { lockedAt: settlementAt }, { merge: true });
    }
  });

  const legacyExpenses = await getDocs(
    query(collection(db, "expenses"), where("groupId", "==", groupId))
  );
  legacyExpenses.docs.forEach((expenseDoc) => {
    const data = expenseDoc.data();
    const createdAt = toMillis(data.createdAt);
    if (!data.lockedAt && createdAt <= settlementAt) {
      batch.set(expenseDoc.ref, { lockedAt: settlementAt }, { merge: true });
    }
  });

  await batch.commit();
  await addActivityRecord(groupId, "settlement.completed", `${payment.from} paid ${payment.to}.`, {
    settlementKey: payment.settlementKey,
    from: payment.from,
    to: payment.to,
    amount: payment.amount,
    token: payment.currency,
    txHash: payment.txHash ?? "",
  }, payment.from);

  const gMembers: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];
  const settlementTargets = [
    gMembers.find((m: Record<string, unknown>) => m.displayName === payment.from)?.profileId,
    gMembers.find((m: Record<string, unknown>) => m.displayName === payment.to)?.profileId,
  ].filter(Boolean) as string[];
  if (settlementTargets.length > 0) {
    await notifySpecificMembers(
      groupId,
      "settlement.completed",
      `${payment.from} paid ${payment.to} ${payment.currency} ${payment.amount.toFixed(2)}.`,
      payment.from,
      settlementTargets,
      groupData.name as string
    );
  }
}

const DEMO_MEMBER_NAMES = ["Lou", "Ada", "John", "Sarah", "Mike"];

const DEMO_WALLETS: Record<string, string> = {
  Lou: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  Ada: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  John: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  Sarah: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  Mike: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};

export async function generateDemoGroup(): Promise<string> {
  const now = Date.now();
  const allGroups = await getAllGroups();
  const existing = allGroups.find((g) => g.name === "Weekend Trip" && g.isDemo);
  if (existing) return existing.id;

  const members = DEMO_MEMBER_NAMES.map((name) =>
    createMember(name, DEMO_WALLETS[name] ?? "", undefined, now)
  );
  const wallets = memberWalletMap(members);

  const groupRef = await addDoc(collection(db, "groups"), {
    name: "Weekend Trip",
    description: "Sample group demonstrating expense sharing and Arc settlement.",
    members: serializeMembersForFirestore(members),
    memberWallets: wallets,
    currency: "USD",
    isDemo: true,
    createdAt: serverTimestamp(),
  });
  const groupId = groupRef.id;

  await addActivityRecord(groupId, "group.created", "Weekend Trip was created.", {
    groupName: "Weekend Trip",
    currency: "USD",
    memberCount: 5,
    isDemo: true,
  });

  for (const m of members) {
    await addActivityRecord(groupId, "member.added", `${m.displayName} was added to the group.`, {
      memberId: m.id,
      memberName: m.displayName,
    });
  }

  const expenses: Array<{
    description: string;
    amount: number;
    paidBy: string;
    category: ExpenseCategory;
  }> = [
    { description: "Hotel Booking", amount: 150, paidBy: "Ada", category: "accommodation" },
    { description: "Dinner", amount: 60, paidBy: "Lou", category: "food" },
    { description: "Taxi Ride", amount: 30, paidBy: "Sarah", category: "transport" },
    { description: "Movie Tickets", amount: 80, paidBy: "John", category: "entertainment" },
    { description: "Coffee Run", amount: 25, paidBy: "Mike", category: "food" },
  ];

  for (const exp of expenses) {
    const expenseRef = await addDoc(collection(db, "groups", groupId, "expenses"), {
      groupId,
      description: exp.description,
      amount: exp.amount,
      paidBy: exp.paidBy,
      splitAmong: DEMO_MEMBER_NAMES,
      category: exp.category,
      date: now,
      notes: "",
      createdAt: serverTimestamp(),
    });
    await addActivityRecord(
      groupId,
      "expense.created",
      `${exp.description} was added.`,
      {
        expenseId: expenseRef.id,
        description: exp.description,
        amount: exp.amount,
        paidBy: exp.paidBy,
        splitAmong: DEMO_MEMBER_NAMES,
        category: exp.category,
      },
      exp.paidBy
    );
  }

  return groupId;
}
