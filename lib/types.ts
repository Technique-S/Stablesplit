export interface Member {
  id: string;
  displayName: string;
  walletAddress?: string;
  avatarColor?: string;
  createdAt: number;
  joinedAt?: number;
  profileId?: string;
  role?: "owner" | "member";
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarURL?: string;
  walletAddress?: string;
  joinedGroupIds: string[];
  createdGroupIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members: Member[];
  memberWallets?: Record<string, string>;
  createdAt: number;
  currency: string;
  firstSettlementAt?: number;
  isDemo?: boolean;
  inviteCode?: string;
  photoURL?: string;
  templateType?: string;
  createdBy?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  createdAt: number;
  date: number;
  notes?: string;
  category: ExpenseCategory;
  lockedAt?: number;
  recurrence?: RecurrenceConfig;
  recurrenceParentId?: string;
  originalCurrency?: string;
  baseUsdAmount?: number;
  baseEurAmount?: number;
  fxRate?: number;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  category: ExpenseCategory;
  date?: number;
  notes?: string;
  recurrence?: RecurrenceConfig;
  originalCurrency?: string;
  baseUsdAmount?: number;
  baseEurAmount?: number;
  fxRate?: number;
}

export interface GroupInput {
  name: string;
  description: string;
  members: Member[];
  memberWallets?: Record<string, string>;
  currency: string;
  photoURL?: string;
  templateType?: string;
}

export type SupportedCurrency = "USD" | "EUR" | "GBP" | "NGN" | "JPY" | "CAD" | "AUD" | "INR";

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  nextDate: number;
  isPaused: boolean;
}

export type ExpenseCategory =
  | "food"
  | "transport"
  | "accommodation"
  | "entertainment"
  | "utilities"
  | "other";

export interface Balance {
  member: string;
  net: number; // positive = owed money, negative = owes money
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export type SettlementToken = "USDC" | "EUR";
export type SettlementPaymentStatus = "pending" | "paid" | "failed";

export interface SettlementPayment {
  id: string;
  groupId: string;
  settlementKey: string;
  from: string;
  to: string;
  payerWallet: string;
  receiverWallet: string;
  amount: number;
  currency: SettlementToken;
  settlementTokenUsed?: SettlementToken;
  status: SettlementPaymentStatus;
  settlementStatus?: SettlementPaymentStatus;
  txHash?: string;
  batchId?: string;
  settledAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ActivityEventType =
  | "group.created"
  | "group.renamed"
  | "group.description_updated"
  | "group.currency_changed"
  | "group.deleted"
  | "member.added"
  | "member.removed"
  | "member.joined_via_invite"
  | "wallet.linked"
  | "wallet.updated"
  | "invite.generated"
  | "expense.created"
  | "expense.deleted"
  | "settlement.initiated"
  | "settlement.completed"
  | "settlement.failed"
  | "batch.settlement_initiated"
  | "batch.settlement_completed"
  | "batch.settlement_failed";

export interface ActivityRecord {
  id: string;
  groupId: string;
  eventType: ActivityEventType;
  actorName: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  type: ActivityEventType;
  groupId: string;
  groupName: string;
  message: string;
  read: boolean;
  createdAt: number;
  actorName: string;
}
