import { z } from "zod";

export const EXPENSE_CATEGORIES = ["food", "transport", "accommodation", "entertainment", "utilities", "other"] as const;

export const RECURRENCE_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export const SETTLEMENT_CURRENCIES = ["USDC", "EUR"] as const;

export const SETTLEMENT_STATUSES = ["pending", "paid", "failed"] as const;

export const groupBaseSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()),
  description: z.string().max(500).default("").transform((s) => s.trim()),
  members: z.array(z.record(z.unknown())).min(1),
  memberWallets: z.record(z.string()).optional(),
  currency: z.string().length(3).default("USD"),
  templateType: z.string().optional(),
  profileId: z.string().optional(),
  createdBy: z.string().optional(),
});

export const updateGroupBaseSchema = z.object({
  name: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  description: z.string().max(500).transform((s) => s.trim()).optional(),
  currency: z.string().length(3).optional(),
  members: z.array(z.record(z.unknown())).optional(),
  memberWallets: z.record(z.string()).optional(),
  photoURL: z.string().optional(),
  templateType: z.string().optional(),
});

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(100).transform((s) => s.trim()),
  walletAddress: z.string().optional(),
  includeInUnsettled: z.boolean().optional(),
  profileId: z.string().optional(),
});

export const expenseBaseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  paidBy: z.string().min(1),
  splitAmong: z.array(z.string()).min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.number().optional(),
  notes: z.string().optional(),
});

export const createExpenseSchema = expenseBaseSchema.extend({
  recurrence: z.object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    nextDate: z.number(),
    isPaused: z.boolean(),
  }).optional(),
  originalCurrency: z.string().optional(),
  baseUsdAmount: z.number().optional(),
  baseEurAmount: z.number().optional(),
  fxRate: z.number().optional(),
});

export const updateExpenseSchema = expenseBaseSchema.partial();

export const profileBaseSchema = z.object({
  displayName: z.string().max(100).optional(),
  avatarURL: z.string().optional(),
  walletAddress: z.string().optional(),
});

export const patchProfileSchema = profileBaseSchema.extend({
  profileId: z.string().optional(),
  joinedGroupIds: z.object({ $addToSet: z.string() }).optional(),
  createdGroupIds: z.object({ $addToSet: z.string() }).optional(),
});

export const activitySchema = z.object({
  groupId: z.string().min(1),
  eventType: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  actorName: z.string().default("StableSplit"),
});

export const settlementSchema = z.object({
  groupId: z.string().min(1),
  settlementKey: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  payerWallet: z.string().optional(),
  receiverWallet: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(SETTLEMENT_CURRENCIES),
  status: z.enum(SETTLEMENT_STATUSES),
  txHash: z.string().optional(),
  batchId: z.string().optional(),
  createdAt: z.number().optional(),
});
