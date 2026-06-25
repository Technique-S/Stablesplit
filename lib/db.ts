import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
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
import { apiRequest } from "./api-client";
import { toMillis } from "./timestamp";

function logFirestoreError(operation: string, context: Record<string, unknown>, error: unknown): void {
  console.error(`[Firestore:${operation}]`, {
    context,
    error,
    message: error instanceof Error ? error.message : String(error),
  });
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
  actorName = "StableSplit",
  walletAddress?: string
): Promise<void> {
  try {
    await apiRequest("POST", "/api/activity", {
      groupId,
      eventType,
      description,
      metadata,
      actorName,
    }, walletAddress);
  } catch (error) {
    console.error("[addActivityRecord]", error);
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
  const { groupId } = await apiRequest<{ groupId: string }>("POST", "/api/groups", {
    name,
    description,
    members,
    memberWallets,
    currency,
    templateType,
    profileId,
    createdBy: createdBy ?? profileId,
  }, createdBy ?? profileId);
  return groupId;
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
  const { groupId, groupName } = await apiRequest<{ groupId: string; groupName: string; alreadyMember?: boolean }>(
    "POST", "/api/groups/join",
    { inviteCode, displayName, walletAddress, includeInUnsettled, profileId },
    walletAddress
  );
  return { groupId, groupName };
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

export async function updateGroup(
  groupId: string,
  input: GroupInput,
  walletAddress?: string
): Promise<void> {
  await apiRequest("PATCH", `/api/groups/${groupId}`, {
    name: input.name,
    description: input.description,
    currency: input.currency,
    members: input.members,
    memberWallets: input.memberWallets,
    photoURL: input.photoURL,
    templateType: input.templateType,
  }, walletAddress);
}

export async function updateMemberWallet(
  groupId: string,
  memberId: string,
  walletAddress: string,
  callerAddress?: string
): Promise<void> {
  await apiRequest("PATCH", `/api/groups/${groupId}`, {
    operation: "updateWallet",
    memberId,
    walletAddress,
  }, callerAddress);
}

export async function deleteGroup(groupId: string, walletAddress?: string): Promise<void> {
  await apiRequest("DELETE", `/api/groups/${groupId}`, {}, walletAddress);
}

// Expenses
export async function createExpense(
  groupId: string,
  expense: ExpenseInput,
  walletAddress?: string
): Promise<string> {
  const { expenseId } = await apiRequest<{ expenseId: string }>("POST", "/api/expenses", {
    groupId,
    ...expense,
  }, walletAddress);
  return expenseId;
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
  walletAddress?: string
): Promise<void> {
  await apiRequest("DELETE", `/api/expenses/${expenseId}`, { groupId }, walletAddress);
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
  },
  walletAddress?: string
): Promise<void> {
  await apiRequest("POST", "/api/settlements", {
    groupId,
    ...payment,
  }, walletAddress);
}

const DEMO_MEMBER_NAMES = ["Lou", "Ada", "John", "Sarah", "Mike"];

const DEMO_WALLETS: Record<string, string> = {
  Lou: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  Ada: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  John: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  Sarah: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  Mike: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};

async function findExistingDemoGroup(): Promise<string | null> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "groups"),
        where("name", "==", "Weekend Trip"),
        where("isDemo", "==", true)
      )
    );
    if (!snap.empty) return snap.docs[0].id;
  } catch {
    // composite index may not exist — fall back to scanning safely
  }
  return null;
}

export async function generateDemoGroup(walletAddress?: string): Promise<string> {
  const { groupId } = await apiRequest<{ groupId: string }>("POST", "/api/demo", {}, walletAddress);
  return groupId;
}
