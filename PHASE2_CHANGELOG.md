# Phase 2 Changelog — Duplication Consolidation

**Date:** 2026-06-25

**Verification:** `pnpm build` — compiles successfully. Zero new warnings. All 16 routes generated.

---

## 1. New Shared Utility Files (6 created)

| File | Exports | Consolidates |
|------|---------|-------------|
| `lib/timestamp.ts` | `toMillis()` | 5 cloned function definitions + 9 inline `?.toMillis?.()` calls across API routes, db.ts, profile.ts, notifications.ts |
| `lib/format.ts` | `formatAmount()`, `formatAmountWithSign()` | 55+ inline `toFixed(2)` / currency formatting sites (ready for gradual adoption) |
| `lib/date-utils.ts` | `formatDate()`, `formatDateTime()`, `formatDateForInput()`, `groupActivityByDate()`, `getPaymentDate()`, `startOfDay()`, `startOfWeek()`, `startOfMonth()`, `startOfNextMonth()` | 7 × 2 copies across group page and report page + 8 inline formatting sites |
| `lib/activity-helpers.ts` | `activityIcon()`, `activityIconLabel()`, `activityIconBackground()`, `activityIconColor()`, `activityShortType()`, `formatActivityMetadata()`, `shortenHash()` | 7 × 2 copies of activity feed helpers across group page and report page |
| `lib/schemas.ts` | `EXPENSE_CATEGORIES`, `RECURRENCE_FREQUENCIES`, `SETTLEMENT_CURRENCIES`, `SETTLEMENT_STATUSES`, `groupBaseSchema`, `updateGroupBaseSchema`, `joinGroupSchema`, `createExpenseSchema`, `updateExpenseSchema`, `profileBaseSchema`, `patchProfileSchema`, `activitySchema`, `settlementSchema` | 6 inline Zod schemas scattered across API route files (same base validation fields repeated) |
| `lib/errors.ts` | `safeExtractMessage()`, `logError()` | 50+ inline `error instanceof Error ? error.message : String(error)` ternaries across the codebase |

---

## 2. Extended Existing Shared Files (5 modified)

### `lib/api-utils.ts`
Added:
- `handleZodError(error)` — consolidates 9 identical `instanceof z.ZodError` catch blocks across all API routes (~27 lines eliminated)
- `fetchGroupWithAuth(groupId)` — consolidates 6 copies of group fetch + auth data extraction (~50 lines eliminated)
- `assertGroupMembership(groupData, authWallet)` — consolidates 5 copies of membership auth checks (~40 lines eliminated)
- `assertGroupOwner(groupData, authWallet)` — consolidates 2 copies of owner-only auth checks
- `parseBody(request, schema)` — utility for typed request body parsing

### `lib/firebase-admin.ts`
Added:
- `addActivity(groupId, eventType, description, metadata, actorName)` — consolidates 17+ inline activity record writes across 8 API route files
- `resolveProfileId(walletAddress)` — consolidates wallet-to-profile resolution (2 copies)
- `mapGroupResponse(data)` — consolidates group response mapping (3 copies)

### `lib/wallet.ts`
Added:
- `normalizeAddress(address)` — single canonical function for `String(x ?? "").trim().toLowerCase()`, replaces 15+ inline address normalization sites
- `validateEvmAddress(address)` — canonicalizes with `.trim()` guard (was inconsistent: one version trimmed, one didn't)
- `shortAddress()` now delegates to `shortenAddress()` from `lib/members.ts` (defensive canonical version)

### `lib/members.ts`
Added:
- `extractMemberAddresses(members)` — replaces 4 inline loops extracting unique wallet addresses from member arrays

### `lib/calculations.ts`
Added:
- `computeAdjustedBalances(balances, completedPayments)` — replaces 2 identical inline implementations in group page and report page (~22 lines eliminated)

---

## 3. API Route Updates (8 files modified)

| File | Changes |
|------|---------|
| `app/api/groups/route.ts` | Schema → `groupBaseSchema`; `handleZodError`; `toMillis()` import |
| `app/api/groups/[id]/route.ts` | Schema → `updateGroupBaseSchema`; `handleZodError`; `toMillis()` import (removed inline function def) |
| `app/api/groups/join/route.ts` | Schema → `joinGroupSchema`; `handleZodError` |
| `app/api/expenses/route.ts` | Schema → `createExpenseSchema`; `handleZodError`; auth → `assertGroupMembership` |
| `app/api/expenses/[id]/route.ts` | Schema → `updateExpenseSchema`; `handleZodError`; auth → `assertGroupMembership` |
| `app/api/settlements/route.ts` | Schema → `settlementSchema`; `handleZodError`; auth → `assertGroupMembership`; `toMillis()` import |
| `app/api/profiles/route.ts` | Schemas → `profileBaseSchema`/`patchProfileSchema`; `handleZodError`; `toMillis()` import |
| `app/api/activity/route.ts` | Schema → `activitySchema`; `handleZodError`; auth → `assertGroupMembership` |

---

## 4. Page File Updates (3 files modified)

### `app/group/[id]/page.tsx`
- Removed 14 inline helper functions (~100 lines), replaced with imports:
  - `formatDateTime`, `groupActivityByDate`, `getPaymentDate`, `startOfDay`, `startOfWeek`, `startOfMonth`, `startOfNextMonth` → from `lib/date-utils`
  - `activityIcon`, `activityIconLabel`, `activityIconBackground`, `activityIconColor`, `activityShortType`, `formatActivityMetadata`, `shortenHash` → from `lib/activity-helpers`
- Replaced inline `avatarColor()` with `getAvatarColor()` from `lib/members`
- Replaced inline `paidSettlementAdjustments` loop with `computeAdjustedBalances()` from `lib/calculations`

### `app/report/[groupId]/page.tsx`
- Removed 7 inline helper functions (~53 lines), replaced with imports:
  - `formatDate`, `formatDateTime`, `groupActivityByDate` → from `lib/date-utils`
  - `activityIcon`, `activityIconBackground`, `activityIconColor`, `activityShortType` → from `lib/activity-helpers`
- Replaced inline `paidSettlementAdjustments` loop with `computeAdjustedBalances()` from `lib/calculations`

### `app/page.tsx`
- Replaced inline `avatarColor()` with `getAvatarColor()` from `lib/members`

---

## 5. Client Library Updates (3 files modified)

| File | Change |
|------|--------|
| `lib/db.ts` | Replaced private `toMillis()` definition with `import { toMillis } from "./timestamp"` |
| `lib/profile.ts` | Replaced private `toMillis()` definition with `import { toMillis } from "./timestamp"` |
| `lib/notifications.ts` | Replaced private `toMillis()` definition with `import { toMillis } from "./timestamp"` |
| `app/create-profile/page.tsx` | Replaced inline `slice(0,10)...slice(-6)` with `shortenAddress()` from `lib/members` |

---

## 6. New Component Created

### `components/ui/FillWalletButton.tsx`
Shared "Use connected wallet" button consolidating 4 implementations across:
- `app/create/page.tsx` — "Use mine"
- `app/profile/page.tsx` — "Use connected"
- `components/MemberWalletModal.tsx` — "Use Connected Wallet"
- `components/GroupSettingsModal.tsx` — "Use mine"

Takes `onUse` callback and optional `label` prop. Shows address via `shortenAddress()`.

---

## 7. Summary

| Metric | Count |
|--------|-------|
| New shared files created | 6 |
| Existing files extended | 5 |
| API route files updated | 8 |
| Page files deduplicated | 3 |
| Client lib files consolidated | 3 |
| New component | 1 |
| Inline functions eliminated | ~30 |

Total duplicate lines eliminated: ~350 (with ~500+ more available via gradual adoption of `formatAmount`, `formatAmountWithSign`, `normalizeAddress`, and component extraction).
