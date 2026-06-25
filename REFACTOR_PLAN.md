# StableSplit Refactor Plan

> **For agentic workers:** This plan synthesizes findings from DEAD_CODE_REPORT.md, DUPLICATION_REPORT.md, and ARCHITECTURE_REVIEW.md. Each phase is designed to produce independently shippable improvements. Steps use checkbox syntax for tracking.

**Goal:** Eliminate dead code, consolidate 43 duplication clusters, introduce a service layer, decompose monolithic pages, and establish consistent client-server boundaries.

**Architecture:** Strangler fig pattern — new structure grows alongside old over 4 phases. Each phase delivers value independently.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Firestore + Admin SDK, Wagmi 3, Viem 2, Reown AppKit, Tailwind CSS 4.

---

## Phase 1: Safe Cleanup & Foundation

**Theme:** Zero-risk improvements — remove dead code, consolidate duplicated utilities, establish shared infrastructure. No behavioral changes.

**Risk:** LOW

**Total files touched:** ~30 create + ~40 modify + ~10 delete

---

### Task 1.1: Create shared utility modules

Extract duplicated utility functions into canonical locations. Every file created here is a pure extraction — no behavioral change.

| New File | Consolidates | Source of Truth |
|----------|-------------|-----------------|
| `lib/utils/timestamp.ts` | `toMillis` (5 defs + 4 inline sites) | Single `export function toMillis(value: unknown): number` |
| `lib/utils/format.ts` | `formatAmount` (55+ inline `toFixed(2)`), `shortenAddress` (3 copies) | `formatAmount(n, c)`, `formatAmountWithSign(n, c)`, `shortenAddress(a)` |
| `lib/utils/date-utils.ts` | `formatDate`, `formatDateTime`, `groupActivityByDate` (7x2 copies) | `formatDate(ts)`, `formatDateTime(ts)`, `formatDateForInput(ts)` |
| `lib/utils/activity-helpers.ts` | `activityIcon`, `activityIconBackground`, `activityIconColor`, `activityShortType` (7x2 copies) | All 7 helpers from report page + group page |
| `lib/server/auth.ts` | `verifyAuth`, `assertGroupMembership`, `assertGroupOwner`, `fetchGroupWithAuth` | Split from `lib/api-utils.ts` |
| `lib/server/errors.ts` | `errorResponse`, `okResponse`, `handleError`, `handleZodError`, `parseBody` | Split from `lib/api-utils.ts` |
| `lib/server/validation.ts` | Zod schemas: `EXPENSE_CATEGORIES`, `groupBaseSchema`, `expenseBaseSchema`, `profileBaseSchema` | Extract overlapping fields from route files |
| `lib/server/activity.service.ts` | Activity record creation (17+ instances across 8 route files) | `addActivity(groupId, eventType, description, metadata, actorName?)` |
| `lib/errors.ts` (client) | `safeExtractMessage`, `logError` | Error utility for client-side code |

**Files modified:**
- `lib/api-utils.ts` — thin re-exports from `lib/server/auth.ts` and `lib/server/errors.ts` for backward compatibility
- `lib/db.ts` — replace internal `toMillis` usage with import from `lib/utils/timestamp.ts`
- `lib/profile.ts` — remove duplicate `toMillis`, import from `lib/utils/timestamp.ts`
- `lib/notifications.ts` — remove duplicate `toMillis`, import from `lib/utils/timestamp.ts`
- `app/api/groups/[id]/route.ts` — remove inline `toMillis`, import from `lib/utils/timestamp.ts`
- `app/api/profiles/route.ts` — remove inline arrow `toMillis`, import from `lib/utils/timestamp.ts`
- `lib/calculations.ts` (future) — will consume `formatAmount` once UI integrates it

**Risk level:** LOW — pure add + import swaps. Old exports remain until Phase 2 cleanup.

**Expected impact:** Eliminates 4 duplicate function definitions and 55+ inline formatting patterns after full rollout.

**Validation strategy:**
1. `npm run build` must pass with no TypeScript errors
2. Import the new `toMillis` in each file — run existing dev server, verify pages load
3. Verify timestamp-dependent features (group dates, expense dates) render correctly

**Rollback:**
- New files: just delete them, revert the import swaps in modified files
- Old exports in `api-utils.ts`: re-exports are additive, removing them is safe

---

### Task 1.2: Remove dead code (safe deletions)

**Files to delete:**
- `components/ui/Button.tsx` — unused component, zero JSX usage
- `components/ui/index.ts` — unused barrel file, never imported
- `lib/wallet-empty-accounts.ts` — empty stub (`export {}`)
- `lib/api-client.ts` — unused fetch wrapper, zero imports
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — unused boilerplate

**Exports to remove (internal-only, never imported externally):**
- `lib/db.ts:41` — `toMillis` (make private → `function`)
- `lib/db.ts:326` — `getAllGroups` (delete — never called, security risk)
- `lib/db.ts:359` — `addMemberToGroup` (delete — never called)
- `lib/db.ts:404` — `addExpense` (delete — never called, use `createExpense`)
- `lib/profile.ts:13` — `toMillis` (make private → `function`)
- `lib/profile.ts:115` — `updateProfileDisplayName` (delete — never called)
- `lib/profile.ts:119` — `updateProfileWallet` (delete — never called)
- `lib/notifications.ts:18` — `toMillis` (make private → `function`)
- `lib/notifications.ts:167` — `getUnreadNotifications` (make private)
- `lib/members.ts:66` — `normalizeWalletAddress` (make private)
- `lib/members.ts:153` — `findMember` (make private)
- `lib/rates.ts:3` — `fetchRates` (make private)
- `lib/recurrence.ts:33` — `formatRecurrenceDescription` (delete — never called)
- `lib/image-upload.ts:64` — `revokeObjectURL` (delete — never called)
- `lib/calculations.ts:117` — `CATEGORY_COLORS` (delete — never used)
- `components/ui/Skeleton.tsx:3` — `Skeleton` (make private)
- `components/ui/Toast.tsx:26` — `useToast` (delete — never called)
- `components/FloatingActionMenu.tsx:5` — `FabAction` (delete — only used as internal type)
- `lib/api-utils.ts:3` — `AuthResult` (keep as internal type, remove `export`)

**Unused dependencies to remove from `package.json`:**
- `@lit/reactive-element`
- `@metamask/connect-evm`
- `@phosphor-icons/webcomponents`
- `@walletconnect/ethereum-provider`
- `lit`
- `lit-element`
- `porto`
- `accounts` (also remove webpack + turbopack alias from `next.config.ts`)

**Unused directories to archive:**
- `stable/` — entire directory
- `dataconnect/` — entire directory (if not actively used)
- `src/dataconnect-generated/` — entire directory

**Risk level:** LOW — every item verified as unused via grep. No behavioral impact.

**Expected impact:** Removes ~10 files, ~17 dead exports, 8 unused dependencies, and 3 unused directories. Reduces bundle size.

**Validation strategy:**
1. `grep` each export before deletion — confirm zero external references
2. Delete one file/export at a time
3. `npm run build` after each batch
4. For dependencies: run the app, verify wallet connection, group operations, and expense creation still work

**Rollback:**
- Git checkout is sufficient for all deletions
- Dependencies: `pnpm add <package>@<version>`
- Build config: revert `next.config.ts`

---

### Task 1.3: Consolidate server-side duplicate logic (1.5-1.6, 2.2-2.6)

Use the newly created shared modules to eliminate server-side duplication.

**Sub-task 1.3a: Replace inline memberWalletMap with shared function**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/groups/route.ts:73-80` | 8-line loop | `const memberWallets = memberWalletMap(members);` |
| `app/api/groups/[id]/route.ts:110-115` | 6-line loop | Same |
| `app/api/groups/[id]/route.ts:149-156` | 8-line loop | Same |
| `app/api/groups/[id]/route.ts:196-202` | 7-line loop | Same |
| `app/api/groups/join/route.ts:67-74` | 8-line loop | Same |
| `app/api/demo/route.ts:36-42` | 7-line loop | Same |

**Sub-task 1.3b: Replace inline createMember with shared function**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/groups/route.ts:58-66` | 9-line block | `createMember(name, wallet)` |
| `app/api/groups/[id]/route.ts:100-108` | 9-line block | Same |
| `app/api/groups/[id]/route.ts:186-194` | 9-line block | Same |
| `app/api/groups/join/route.ts:55-63` | 9-line block | Same |
| `app/api/demo/route.ts:28-34` | 7-line block | Same |

**Sub-task 1.3c: Replace inline group membership check with `assertGroupMembership`**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/expenses/route.ts:38-47` | 10 lines | `assertGroupMembership(groupData, auth);` |
| `app/api/expenses/[id]/route.ts:44-51` | 8 lines | Same |
| `app/api/expenses/[id]/route.ts:103-110` | 8 lines | Same |
| `app/api/settlements/route.ts:32-39` | 8 lines | Same |
| `app/api/activity/route.ts:26-31` | 6 lines | Same |

**Sub-task 1.3d: Replace inline group owner check with `assertGroupOwner`**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/groups/[id]/route.ts:88-90` | 3 lines | `assertGroupOwner(groupData, auth);` |
| `app/api/groups/[id]/route.ts:271-273` | 3 lines | Same |

**Sub-task 1.3e: Replace inline ZodError catch blocks**

| File | Lines | Replace With |
|------|-------|-------------|
| All 9 route files | 3 lines each | `const zodRes = handleZodError(error); if (zodRes) return zodRes;` |

**Sub-task 1.3f: Replace inline group fetch + auth extraction with `fetchGroupWithAuth`**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/expenses/route.ts:32-40` | 9 lines | `const { ref, data, createdBy, memberAddresses, members } = await fetchGroupWithAuth(groupId);` |
| `app/api/expenses/[id]/route.ts:39-46` | 8 lines | Same |
| `app/api/expenses/[id]/route.ts:98-105` | 8 lines | Same |
| `app/api/settlements/route.ts:27-34` | 8 lines | Same |
| `app/api/activity/route.ts:20-27` | 8 lines | Same |

**Sub-task 1.3g: Replace inline activity creation**

| File | Count | Replace With |
|------|-------|-------------|
| `app/api/groups/route.ts` | 2 | `addActivity(groupId, "group.created", ...)` |
| `app/api/groups/[id]/route.ts` | 6 | Same |
| `app/api/groups/join/route.ts` | 3 | Same |
| `app/api/expenses/route.ts` | 1 | Same |
| `app/api/expenses/[id]/route.ts` | 1 | Same |
| `app/api/settlements/route.ts` | 2 | Same |
| `app/api/demo/route.ts` | 2 | Same |

**Sub-task 1.3h: Replace inline `generateInviteCode`**

- `app/api/groups/route.ts:17-26` — import `generateInviteCode` from `lib/db.ts`

**Sub-task 1.3i: Replace inline wallet-to-profile resolution**

- `app/api/groups/route.ts:28-47` (`getProfileIdForWallet`) — use `resolveProfileId` from `lib/server/auth.ts`
- `app/api/profiles/route.ts:21-45` (`readOrMigrateProfile`) — use `resolveProfileId`

**Sub-task 1.3j: Replace inline group response mapping**

| File | Lines | Replace With |
|------|-------|-------------|
| `app/api/groups/route.ts:148-164` | 17 lines | `mapGroupResponse(data)` |
| `app/api/groups/[id]/route.ts:59-73` | 15 lines | Same |

**Sub-task 1.3k: Replace inline settlement key generation**

| File | Lines | Replace With |
|------|-------|-------------|
| `lib/db.ts:135-137` | 3 | `createSettlementKey({ from, to, amount })` from `lib/arc-payments.ts` |
| `app/api/settlements/route.ts:149` | 1 | Same |

**Risk level:** LOW-MEDIUM — each replacement is mechanical. The `fetchGroupWithAuth` change touches auth flow, which needs careful review.

**Expected impact:** Eliminates ~300 lines of duplicated server-side logic. Establishes canonical function locations.

**Validation strategy:**
1. After each sub-task, run the specific API route through its happy path:
   - POST to create a group → verify `groupId` returned
   - POST to create an expense → verify expense appears in Firestore
   - POST to initiate settlement → verify settlement record
2. Run `npm run build` after each sub-task
3. Test auth edge cases: non-member tries to create expense → expect 403

**Rollback:** Per-file git revert of each sub-task.

---

### Task 1.4: Consolidate wallet address handling

**Sub-task 1.4a: Canonicalize `validateEvmAddress`**

- Keep `lib/members.ts:72-74` as the canonical version (`.trim()` + `isAddress`)
- Make `lib/arc-payments.ts:34-36` call the canonical version (re-export or import)
- Add a re-export from `lib/wallet.ts` for discoverability
- Update all 3 callers

**Sub-task 1.4b: Create `normalizeAddress` canonical function**

- Add `normalizeAddress(address: unknown): string` to `lib/wallet.ts`
- Implementation: `String(address ?? "").trim().toLowerCase()`
- Replace all 15+ inline sites (Patterns A-D from DUPLICATION_REPORT.md §1.4)

**Sub-task 1.4c: Canonicalize `shortenAddress`**

- Keep `shortenAddress` in `lib/members.ts` as canonical (most defensive)
- Replace `shortAddress` in `lib/wallet.ts` with re-export
- Replace inline in `lib/export.ts:140` and `app/create-profile/page.tsx:112`

**Risk level:** LOW — mechanical replacements.

**Expected impact:** Single source of truth for all wallet address operations.

**Validation strategy:**
1. Run `npm run build`
2. Test address validation in MemberWalletModal and profile pages
3. Verify address shortening renders correctly in settlement views

**Rollback:** Per-file git revert.

---

## Phase 2: Server Architecture Improvements

**Theme:** Extract service layer from API route monoliths. Establish per-domain server modules.

**Risk:** MEDIUM

**Depends on:** Phase 1 (shared utilities must exist)

---

### Task 2.1: Extract group service + repo

**Create:**
- `lib/server/groups.service.ts` — `createGroup()`, `updateGroup()`, `deleteGroup()`, `addMember()`, `updateMemberWallet()`
- `lib/server/groups.repo.ts` — `getGroupById()`, `createGroupDoc()`, `updateGroupDoc()`, `deleteGroupDoc()`, `getGroupByInviteCode()`

**Modify:**
- `app/api/groups/route.ts` — thin POST handler: `parseBody` → `verifyAuth` → `groupsService.createGroup(...)` → `okResponse`
- `app/api/groups/route.ts` — thin GET handler: `verifyAuth` → `groupsService.listGroups(auth.uid)` → `okResponse`
- `app/api/groups/[id]/route.ts` — thin GET/PATCH/DELETE handlers delegating to service
- `app/api/groups/join/route.ts` — thin POST handler delegating to service

**Service layer boundaries:**
```
groups.service.ts:
  - Orchestrates: Firestore writes, activity logging, invite code generation
  - Does NOT: parse HTTP, validate Zod schemas, format responses
  - DOES: throw typed errors (NotFoundError, UnauthorizedError)

groups.repo.ts:
  - Firestore queries ONLY
  - No business logic, no side effects
  - Returns raw DocumentData or typed entities
```

**Risk level:** MEDIUM — extraction must preserve all request/response contracts.

**Expected impact:** Reduces `app/api/groups/[id]/route.ts` from 300+ lines to ~80 lines. Makes business logic testable.

**Validation strategy:**
1. Create a test file `lib/server/__tests__/groups.service.test.ts` (if testing infra exists) OR
2. Test via API: POST group, PATCH group, DELETE group — verify responses match pre-refactor responses exactly
3. Test auth: non-member PATCH → 403, non-owner DELETE → 403
4. Run `npm run build`

**Rollback:** Git revert per route file. Old behavior is preserved in the service — the routes just delegate.

---

### Task 2.2: Extract expense service + repo

**Create:**
- `lib/server/expenses.service.ts` — `createExpense()`, `updateExpense()`, `deleteExpense()`
- `lib/server/expenses.repo.ts` — `getExpenseById()`, `createExpenseDoc()`, `updateExpenseDoc()`, `deleteExpenseDoc()`

**Modify:**
- `app/api/expenses/route.ts` — thin handler
- `app/api/expenses/[id]/route.ts` — thin handler
- `lib/recurrence.ts` — use expense service instead of direct `addDoc`

**Risk level:** MEDIUM — same pattern as Task 2.1.

**Validation strategy:** Same as Task 2.1 — create expense, verify payload, verify auth check.

---

### Task 2.3: Extract settlement service + repo

**Create:**
- `lib/server/settlements.service.ts` — `initiateSettlement()`, `completeSettlement()`, `listSettlements()`
- `lib/server/settlements.repo.ts` — Firestore queries

**Modify:**
- `app/api/settlements/route.ts` — thin handlers
- `components/SettleAllModal.tsx` — use service (or keep as-is, Phase 3)

**Risk level:** MEDIUM — settlement logic has more complex batch operations and idempotency checks.

**Validation strategy:** Test settlement creation with various payment amounts, verify expense locking, verify activity logging.

---

### Task 2.4: Extract profile service + repo

**Create:**
- `lib/server/profiles.service.ts` — `createProfile()`, `updateProfile()`, `getProfile()`
- `lib/server/profiles.repo.ts` — Firestore queries

**Modify:**
- `app/api/profiles/route.ts` — thin handlers

**Risk level:** LOW — profile logic is the simplest.

---

### Task 2.5: Standardize API response format

**Problem:** ARCHITECTURE_REVIEW.md §2.8 identified inconsistent response shapes across all endpoints.

**Change:**
- Add an `ApiResponse<T>` wrapper type to `lib/server/errors.ts`:
  ```typescript
  type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }
  ```
- Migrate `okResponse(data)` → wraps with `{ success: true, data }`
- Migrate `errorResponse(message, status)` → wraps with `{ success: false, error: message }`
- Update all route handlers to use the new wrapper
- Add a transitional period where both old and new response formats are accepted by client code

**This task requires coordination with client code** — the dashboard (`app/page.tsx`) reads settlement payments from `GET /api/settlements` and expects `{ payments: [...] }`. If the response changes to `{ success: true, data: { payments: [...] } }`, client parsing must update.

**Risk level:** MEDIUM-HIGH — changes response contracts. Must update client code in lockstep.

**Expected impact:** Consistent `{ success, data/error }` format across all 10 API endpoints.

**Validation strategy:**
1. Phase 2.5 runs AFTER client code is updated (or vice versa in the same PR)
2. Create a wrapper on the client that handles both formats during transition
3. Run full E2E flow: create group → add expense → settle → verify all API calls

**Rollback:** Revert both server and client changes in one commit.

---

## Phase 3: Client Architecture Improvements

**Theme:** Decompose monolithic page files, extract reusable hooks and components.

**Risk:** MEDIUM-HIGH

**Depends on:** Phase 1 (utility consolidation), Phase 2 (consistent API responses)

---

### Task 3.1: Create client-side API modules

**Problem:** All reads go directly to Firestore (no auth). All writes go through ad-hoc `apiRequest` calls.

**Create:**
- `lib/api/client.ts` — base fetch wrapper (replaces dead `lib/api-client.ts`)
  - Adds `x-wallet-address` header automatically from wagmi account
  - Handles `{ success: true, data }` / `{ success: false, error }` response format
  - Handles 401 → redirect to connect wallet
- `lib/api/groups.ts` — `getGroup(id)`, `getGroups()`, `createGroup(data)`, `updateGroup(id, data)`, `deleteGroup(id)`
- `lib/api/expenses.ts` — `getExpenses(groupId)`, `createExpense(data)`, `deleteExpense(id)`
- `lib/api/settlements.ts` — `getSettlements(groupId)`, `initiateSettlement(data)`
- `lib/api/profiles.ts` — `getProfile(wallet)`, `createProfile(data)`, `updateProfile(id, data)`
- `lib/api/activity.ts` — `getActivity(groupId)`

**Existing lib modules to update:**
- `lib/db.ts` — replace Firestore client SDK calls with API calls (e.g., `getGroup` → `groupsApi.getGroup`)
- `lib/profile.ts` — replace direct Firestore with API calls

**Risk level:** HIGH — this is the biggest architectural shift. Currently ALL reads hit Firestore directly. After this change, ALL reads go through API routes with auth. Performance impact from added HTTP round trips.

**Mitigation strategies for latency:**
1. Add React Query or SWR for caching (already have `@tanstack/react-query` in deps)
2. Keep Firestore real-time listeners for the group detail page (`onSnapshot`) behind an opt-in hook
3. Add client-side caching layer in the API modules (in-memory cache with TTL)

**Expected impact:** All reads authenticated. Consistent data mapping. Path to remove client Firestore SDK imports.

**Validation strategy:**
1. Ship API modules alongside existing code — both paths work
2. Migrate one page at a time, starting with the report page (simplest)
3. After each page migration, verify data matches pre-migration
4. After all pages migrated, remove dead Firestore client code from `lib/db.ts`

**Rollback:** Revert the API module for a given domain, restore the old Firestore import.

---

### Task 3.2: Create custom hooks for data access

**Create:**
- `lib/hooks/use-groups.ts` — `useGroup(id)`, `useGroups(ids)` — wraps `groupsApi` + optional real-time
- `lib/hooks/use-expenses.ts` — `useExpenses(groupId)` — wraps `expensesApi`
- `lib/hooks/use-settlements.ts` — `useSettlements(groupId)` — wraps `settlementsApi`
- `lib/hooks/use-activity.ts` — `useActivity(groupId)` — wraps `activityApi`
- `lib/hooks/use-dashboard.ts` — aggregates all data for `app/page.tsx`, replaces 140-line `loadData`
- `lib/hooks/use-report.ts` — aggregates all data for `app/report/[groupId]/page.tsx`

**Each hook provides:**
```typescript
interface UseDataResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}
```

**Risk level:** MEDIUM — hooks are additive. Pages can use them alongside existing code.

**Expected impact:** Removes Firestore imports from pages. Makes data fetching testable.

**Validation strategy:** Swap one page at a time from inline data fetching to hooks.

---

### Task 3.3: Decompose group detail page (`app/group/[id]/page.tsx`)

**Problem:** 1982-line file with 15+ concerns (ARCHITECTURE_REVIEW §2.3).

**Sub-task 3.3a: Extract inline components**

| Component | Current Lines | New File |
|-----------|--------------|----------|
| `WalletBadge` | 1475-1502 (28) | `components/wallet/WalletBadge.tsx` |
| `ExpenseDetailsModal` | 1504-1577 (74) | `components/modals/ExpenseDetailsModal.tsx` |
| `ActivityPanel` | 1579-1706 (128) | `components/activity/ActivityPanel.tsx` |
| `BatchHistoryRenderer` | 1708-1810 (103) | `components/BatchHistoryRenderer.tsx` |
| `InviteSection` | 1812-1873 (62) | **Delete** — dead code, never rendered |
| Filter chips (4 copies) | 736-819 (68) | Use new `FilterChip` component from Phase 1 |

**Sub-task 3.3b: Extract inline helper functions**

| Function | Current Lines | New Home |
|----------|--------------|----------|
| `getPaymentDate` | 1886-1888 (3) | `lib/utils/date-utils.ts` |
| `formatDateTime` | 1890-1898 (9) | `lib/utils/date-utils.ts` |
| `groupActivityByDate` | 1900-1912 (13) | `lib/utils/activity-helpers.ts` |
| `activityIcon` + helpers | 1914-1947 (34) | `lib/utils/activity-helpers.ts` |
| `formatActivityMetadata` | 1949-1955 (7) | `lib/utils/activity-helpers.ts` |
| `shortenHash` | 1957-1960 (4) | `lib/utils/format.ts` |
| `startOfDay/Week/Month` | 1962-1982 (21) | `lib/utils/date-utils.ts` |
| `avatarColor` | 228-233 (6) | Use `getAvatarColor` from `lib/members.ts` (already exists!) |

**Sub-task 3.3c: Replace Firestore listeners with hooks**

Replace:
- `onSnapshot(doc(db, "groups", id))` → `useGroup(id)`
- `onSnapshot(collection(db, "groups", id, "expenses"))` → `useExpenses(id)`
- `onSnapshot(collection(db, "groups", id, "settlementPayments"))` → `useSettlements(id)`
- `onSnapshot(collection(db, "groups", id, "activity"))` → `useActivity(id)`

**Real-time consideration:** If hooks use polling instead of `onSnapshot`, we lose real-time updates. Decision:
- Keep one real-time-only hook (`useGroupRealtime`) for the group detail page
- Use fetch-based hooks for all other pages

**Sub-task 3.3d: Extract inline business logic**

Move the 95-line `useMemo` at lines 302-397:
- Balance calculations → already in `lib/calculations.ts`, ensure page calls it
- Paid settlement adjustments → extract to `lib/calculations.ts` as `computeAdjustedBalances()`
- USD/EUR duplicate blocks → extract to `lib/calculations.ts` as `computeSettlementValues(expenses, field)`

**Risk level:** HIGH — the group page is the most complex. Each extraction changes import paths and may affect rendering. Must be done incrementally, one extraction at a time, with full visual verification after each.

**Expected impact:** Reduces `app/group/[id]/page.tsx` from 1982 to ~600 lines. Creates 6+ new component files and 2+ new hook files.

**Validation strategy:**
1. Extract ONE component at a time
2. After each extraction: load a group page with real data, verify:
   - All 4 tabs render correctly
   - Expenses display properly
   - Balances calculate correctly
   - Activity panel opens and shows events
   - Settlement flow still works
3. Run `npm run build` after each extraction
4. Test on desktop + mobile viewports

**Rollback:** Per-component git revert. If a hook breaks, fall back to direct Firestore (keep the old code path behind a flag during migration).

---

### Task 3.4: Decompose dashboard page (`app/page.tsx`)

**Problem:** 639 lines with 140-line data fetch mixing 5 concerns.

**Sub-task 3.4a: Extract `avatarColor`** — delete inline, use `getAvatarColor` from `lib/members.ts`

**Sub-task 3.4b: Extract inline `formatTime`** — use `formatDateTime` from `lib/utils/date-utils.ts`

**Sub-task 3.4c: Replace 140-line `loadData`** — use `useDashboard` hook

**Sub-task 3.4d: Delete unused `createdGroups` filter** (lines 243-246, dead code)

**Risk level:** MEDIUM — less complex than the group page.

---

### Task 3.5: Decompose report page (`app/report/[groupId]/page.tsx`)

**Problem:** 444 lines with duplicated helpers and inline Firestore reads.

**Sub-task 3.5a: Replace Firestore reads** — `useReport` hook

**Sub-task 3.5b: Replace duplicated helpers** — import from `lib/utils/activity-helpers.ts` and `lib/utils/date-utils.ts`

**Sub-task 3.5c: Extract balance calculation** — use `computeAdjustedBalances` from `lib/calculations.ts`

**Risk level:** LOW — report page is the simplest.

---

### Task 3.6: Consolidate duplicated React components

This task implements the component extractions listed in DUPLICATION_REPORT §5.

| Component | Source Files | Target File |
|-----------|-------------|-------------|
| `ImageUpload` | `GroupImageUpload.tsx` (99L) + `ProfileAvatarUpload.tsx` (100L) | `components/ui/ImageUpload.tsx` |
| `FillWalletButton` | 4 copies across modals + pages | `components/ui/FillWalletButton.tsx` |
| `WalletBadge` | `GroupSettingsModal.tsx:281-308` + `app/group/[id]/page.tsx:1475-1502` | `components/ui/WalletBadge.tsx` |
| `AlertBanner` | 7+ copies across components + pages | `components/ui/AlertBanner.tsx` |
| `BackLink` | 3 copies across pages | `components/ui/BackLink.tsx` |
| `SegmentedControl` | 3 copies across modals + pages | `components/ui/SegmentedControl.tsx` |
| `FilterChip` | 4 copies in group page | `components/ui/FilterChip.tsx` |
| `DemoBadge` | 2 copies across pages | `components/ui/DemoBadge.tsx` |
| `StatCard` | 3 copies across pages | `components/ui/StatCard.tsx` |
| `BalanceList` | 3 copies across pages | `components/BalanceList.tsx` |

**Risk level:** LOW — each is a pure extraction. No behavior change.

**Validation strategy:** After each component extraction:
1. Verify the old location still works (backward compatibility)
2. Verify the new component renders identically
3. Replace one consumer at a time

---

## Phase 4: Advanced Refactoring

**Theme:** Security hardening, provider decoupling, side effect separation, and final cleanup.

**Risk:** HIGH

**Depends on:** Phase 2 (server services), Phase 3 (client hooks + API modules)

---

### Task 4.1: Route all client-side writes through API

**Problem:** Several operations currently write directly to Firestore from the client, bypassing auth (ARCHITECTURE_REVIEW §2.2).

**Writes to move behind API:**

| Operation | Current File | New API Endpoint |
|-----------|-------------|------------------|
| `uploadGroupImage()` | `lib/db.ts:269` | `POST /api/groups/[id]/image` |
| `generateNextOccurrence()` (write part) | `lib/recurrence.ts:70,72` | `POST /api/expenses/[id]/generate-recurrence` |
| `pauseRecurrence()` | `lib/recurrence.ts:103` | `PATCH /api/expenses/[id]` |
| `resumeRecurrence()` | `lib/recurrence.ts:109` | `PATCH /api/expenses/[id]` |
| `deleteRecurrence()` | `lib/recurrence.ts:115` | `PATCH /api/expenses/[id]` |
| `notifyGroupMembers()` | `lib/notifications.ts:82` | `POST /api/notifications` (new route) |
| `notifySpecificMembers()` | `lib/notifications.ts:115` | `POST /api/notifications` (new route) |
| `markNotificationAsRead()` | `lib/notifications.ts:187` | `PATCH /api/notifications/[id]` |
| `markAllNotificationsAsRead()` | `lib/notifications.ts:200` | `POST /api/notifications/mark-all-read` |

**Risk level:** HIGH — notifications currently work without auth. After this change, they require wallet auth. Recurrence currently runs entirely client-side; moving it server-side changes the scheduling model.

**Notification auth strategy:**
- The notification API accepts `x-wallet-address` header
- Server resolves `profileId` from wallet address
- Server verifies the user has permission to read the group (for group-level notifications)
- Server writes to `users/{profileId}/notifications` subcollection

**Recurrence migration strategy:**
- Create `POST /api/expenses/[id]/generate-recurrence` endpoint
- Server reads expense, validates recurrence config, creates new expense doc
- Server-side `serverTimestamp()` replaces client-side `Date.now()`
- Client calls this endpoint instead of `addDoc` directly
- (Long-term: move recurrence to a Cloud Function/database trigger, remove polling)

**Expected impact:** All mutations authenticated. No direct Firestore writes from browser.

**Validation strategy:**
1. Create API endpoints first (they log, don't execute yet)
2. Move each client-side write one at a time
3. Verify each with: authenticated user succeeds, unauthenticated user gets 401
4. Run full E2E flows after each move

**Rollback:** Keep the old client-side code paths as fallbacks during transition. Remove them only after 1 week of successful server-side execution.

---

### Task 4.2: Decouple provider chain

**Sub-task 4.2a: Remove `AppKitThemeSync` from `WalletProvider`**

**Problem:** `WalletProvider.tsx:60-76` calls `useTheme()`, coupling providers.

**Solution:**
- Move theme-to-wallet syncing into a standalone hook (`useThemeWalletSync`)
- The hook is called at page level (`app/layout.tsx`) outside any provider chain
- `WalletProvider` no longer imports from `ThemeProvider`

**Sub-task 4.2b: Create `ProfileContext`**

**Problem:** Navbar directly imports `useProfileCheck` (ARCHITECTURE_REVIEW §3A).

**Solution:**
- Create `lib/hooks/use-profile-context.ts` with `ProfileProvider` + `useProfile`
- `ProfileProvider` calls `useProfileCheck` once at the layout level
- `Navbar` reads from context instead of importing the hook
- All page components read from context instead of each calling `useProfileCheck` redundantly
- Eliminates the redundant Firestore reads (currently 2+ per page navigation)

**Sub-task 4.2c: Decouple `ProfileGuard` from wagmi**

**Problem:** ProfileGuard imports `useAccount` from wagmi.

**Solution:**
- Create a `WalletContext` adapter (returns `isConnected`, `address`)
- `WalletProvider` provides this context
- `ProfileGuard` reads from `WalletContext` instead of wagmi directly
- Enables swapping wallet libraries without changing guard logic

**Risk level:** MEDIUM — provider changes affect the entire app. Must test all routes.

**Expected impact:** Clean provider chain with no hidden cross-dependencies. Reduced Firestore reads.

**Validation strategy:**
1. Each sub-task is one PR
2. After each: load every page in the app, verify no provider errors in console
3. Test wallet connection → profile guard → navigation flow
4. Test with both connected and disconnected wallet states

**Rollback:** Revert the provider change. Old behavior is well-understood.

---

### Task 4.3: Side effect separation

**Problem:** Activity logging and notification dispatch are inline with every mutation (ARCHITECTURE_REVIEW §2.6).

**Solution:**
- `lib/server/activity.service.ts` (created in Phase 1) becomes the single entry point for activity logging
- Each service calls `activityService.log(...)` instead of writing Firestore inline
- `activityService.log(...)` is a fire-and-forget async call — failures are logged, not returned
- (Optional) Use an event emitter pattern:
  ```typescript
  // groups.service.ts
  const group = await groupsRepo.create(data)
  eventBus.emit("group.created", group)  // → activity.service + notifications.service listen
  return group
  ```

**Risk level:** MEDIUM — must ensure activity logging is reliable. Fire-and-forget means lost activity if the database write fails silently.

**Validation strategy:**
1. After migration, create a group, an expense, and a settlement
2. Verify activity records exist in Firestore
3. Simulate activity write failure (mock `adminDb`) — verify the main operation still succeeds

**Rollback:** Revert to inline activity logging (which is the current behavior).

---

### Task 4.4: Final cleanup

**Delete dead code from Phase 1 that needed deprecation lag:**
- `stable/` directory (if not already archived)
- `dataconnect/` and `src/dataconnect-generated/` (if confirmed unused)
- Remove old `toMillis` copies (client-side code should all use `lib/utils/timestamp.ts`)

**Remove legacy API response format support** (from Phase 2.5 transition):
- Remove transitional wrapper that accepted both old and new response formats
- All API calls now expect `{ success: true, data: ... }` format

**Remove deprecated re-exports:**
- `lib/api-utils.ts` re-exports from `lib/server/auth.ts` + `lib/server/errors.ts`
- These can be removed once all imports point directly to server modules

**Verify no remaining dead code:**
- Run a fresh `grep` for any of the removed export names
- Run `npm run build` — zero warnings
- Run `npm run lint` — zero warnings

**Risk level:** LOW — pure deletion of already-unused code.

---

## Phase Dependency Graph

```
Phase 1: Foundation
├── 1.1 Create shared utils ──────────────────────────────┐
├── 1.2 Remove dead code                                  │
├── 1.3 Consolidate server duplicate logic ───────────────┤
└── 1.4 Consolidate wallet address handling ──────────────┤
                                                          │
Phase 2: Server Architecture                               │
├── 2.1 Groups service + repo ─── depends on 1.1, 1.3 ───┤
├── 2.2 Expense service + repo ─── depends on 1.1, 1.3 ───┘
├── 2.3 Settlement service + repo                          │
├── 2.4 Profile service + repo                             │
└── 2.5 Standardize API responses ─── depends on 2.1-2.4 ──┐
                                                           │
Phase 3: Client Architecture                                │
├── 3.1 Create client API modules ─── depends on 2.5 ──────┤
├── 3.2 Create custom hooks ─── depends on 3.1 ────────────┤
├── 3.3 Decompose group page ─── depends on 3.1, 3.2 ─────┤
├── 3.4 Decompose dashboard ─── depends on 3.1, 3.2 ──────┤
├── 3.5 Decompose report page ─── depends on 3.1, 3.2 ────┤
└── 3.6 Consolidate React components ─── depends on 1.1 ───┘
                                                           │
Phase 4: Advanced                                          │
├── 4.1 Route all writes through API ─── depends on 2.x ───┘
├── 4.2 Decouple provider chain ─── depends on 3.2          │
├── 4.3 Side effect separation ─── depends on 2.x, 4.1     │
└── 4.4 Final cleanup ─── depends on all
```

---

## Total Effort Estimate

| Phase | Tasks | Files Created | Files Modified | Files Deleted | Risk | Estimated Effort |
|-------|-------|--------------|---------------|---------------|------|-----------------|
| 1 | 4 | ~12 | ~40 | ~15 | LOW | 3-4 days |
| 2 | 5 | ~10 | ~12 | 0 | MEDIUM | 4-5 days |
| 3 | 6 | ~20 | ~8 | ~2 | MEDIUM-HIGH | 5-7 days |
| 4 | 4 | ~6 | ~15 | ~8 | HIGH | 5-6 days |
| **Total** | **19** | **~48** | **~75** | **~25** | **-** | **17-22 days** |

---

## Per-Phase Summary

### Phase 1: Safe Cleanup & Foundation
**Risk: LOW** | **Effort: 3-4 days**

Establishes the foundation. Pure additive work plus safe deletions. Every improvement can be verified independently. Run this phase first regardless of whether later phases proceed.

**Key deliverables:**
- Dead code removed, bundle size reduced
- `toMillis` consolidated from 5 files to 1
- 6 inline API route patterns consolidated into shared functions
- Wallet address handling canonicalized
- Server auth/error/validation utilities extracted

---

### Phase 2: Server Architecture
**Risk: MEDIUM** | **Effort: 4-5 days**

Extracts service/repo layers from API route monoliths. Each domain (groups, expenses, settlements, profiles) gets a service and repo module. API routes become thin dispatchers. This is the most important architectural improvement.

**Key deliverables:**
- 4 service modules + 4 repo modules
- API routes reduced from 100-300 lines to 20-50 lines each
- Business logic testable without HTTP or Firestore
- Consistent `{ success, data/error }` response format

---

### Phase 3: Client Architecture
**Risk: MEDIUM-HIGH** | **Effort: 5-7 days**

The highest-impact phase for developer experience. Decomposes the 1982-line group page, extracts 7 redundant inline components, creates 10+ custom hooks, and establishes client API modules.

**Key deliverables:**
- Group page reduced from 1982 to ~600 lines
- 10+ reusable UI components extracted
- 5+ custom hooks for data access
- Dashboard and report pages decomposed
- All reads route through API (with auth)

---

### Phase 4: Advanced Refactoring
**Risk: HIGH** | **Effort: 5-6 days**

Security hardening and architectural tightening. Moves remaining client-side writes to server, decouples provider chain, separates side effects. Highest risk because of auth model changes.

**Key deliverables:**
- Zero direct Firestore writes from client
- Provider chain fully decoupled
- Activity/notification side effects separated from data mutations
- Clean slate for future development
