# Duplication Report — StableSplit

Generated: 2026-06-25

## Summary

| Category | Duplicate Clusters | Files Affected | Estimated Excess Lines |
|----------|-------------------|----------------|----------------------|
| Duplicate utilities | 6 | 15 | ~200 |
| Duplicate API logic | 10 | 12 | ~400 |
| Duplicate business logic | 7 | 10 | ~300 |
| Duplicate data transformations | 6 | 20 | ~100 |
| Duplicate React patterns | 14 | 22 | ~500 |
| **Total** | **43 clusters** | **~35 unique files** | **~1500 lines** |

---

## 1. Duplicate Utility Functions

### 1.1 `toMillis` — QUADRUPLICATED (5 definitions + 4 inline sites)

**Severity: HIGH**

| Location | Type | Lines |
|----------|------|-------|
| `lib/db.ts:41-47` | `export function toMillis()` | 7 |
| `lib/profile.ts:13-19` | `export function toMillis()` — identical | 7 |
| `lib/notifications.ts:18-24` | `export function toMillis()` — identical | 7 |
| `app/api/groups/[id]/route.ts:6-12` | `function toMillis()` — identical | 7 |
| `app/api/profiles/route.ts:73-77` | Inline arrow function — equivalent logic | 5 |
| `app/api/groups/route.ts:148` | Inline `data.createdAt?.toMillis?.() ?? data.createdAt ?? 0` | 1 |
| `app/api/settlements/route.ts:97,106` | Inline `?.toMillis?.()` on raw data | 2 |
| `app/api/settlements/route.ts:171-173` | Inline `?.toMillis?.()` on three fields | 3 |
| `app/api/groups/route.ts:158` | Inline `?.toMillis?.()` | 1 |

**Overlap:** All implement the same `Firestore Timestamp → number` conversion:
```
typeof value === "number" → return value
value && "toMillis" in value → value.toMillis()
else → Date.now()
```

**Consolidation:** Extract once into `lib/timestamp.ts`. Remove from `lib/profile.ts`, `lib/notifications.ts`, `app/api/groups/[id]/route.ts`, `app/api/profiles/route.ts`. Replace all inline `?.toMillis?.()` calls. Both client and server can share it (uses only core JS).

---

### 1.2 `validateEvmAddress` — DUPLICATED (2 copies, inconsistent)

**Severity: MEDIUM**

| Location | Lines | Behavior |
|----------|-------|----------|
| `lib/members.ts:72-74` | 3 | `isAddress(address.trim())` — trims input |
| `lib/arc-payments.ts:34-36` | 3 | `isAddress(address)` — no trim |
| `lib/api-utils.ts:10` | 1 | Regex `/^0x[a-fA-F0-9]{40}$/` — no checksum validation |

**Overlap:** All validate EVM wallet addresses. The regex variant skips viem's checksum check.

**Callers:**
- `members.ts` version → `MemberWalletModal.tsx`, `app/profile/page.tsx`, `app/create/page.tsx`
- `arc-payments.ts` version → `SettlementPaymentButton.tsx`
- `api-utils.ts` regex → used inline in `verifyAuth()`

**Consolidation:** Consolidate into `lib/wallet.ts`. Keep `.trim()`. Use `isAddress` from viem. Decide whether `verifyAuth` should use the stronger checksum validation too.

---

### 1.3 Address Shortening — TRIPLICATED (3 implementations)

**Severity: MEDIUM**

| Location | Lines | Pattern |
|----------|-------|---------|
| `lib/members.ts:76-81` | 6 | `` `${slice(0,6)}...${slice(-4)}` `` — defensive (null check, trim, length guard) |
| `lib/wallet.ts:85-88` | 4 | `` `${slice(0,6)}...${slice(-4)}` `` — lax (no trim, no guard) |
| `lib/export.ts:140` | 1 | `slice(0,6) + "..." + slice(-4)` — inline, crashes on undefined |
| `app/create-profile/page.tsx:112` | 1 | `` `${slice(0,10)}...${slice(-6)}` `` — different format |

**Consolidation:** Keep `shortenAddress` from `members.ts` as canonical (most defensive). Remove `shortAddress` from `wallet.ts` or add re-export alias. Replace inline in `export.ts:140` and `create-profile/page.tsx:112`.

---

### 1.4 Wallet Address Normalization — 15+ inline sites, inconsistent

**Severity: HIGH**

**Pattern A — `.toLowerCase()` only (no trim):**
- `lib/api-client.ts:10`
- `app/api/profiles/route.ts:22`
- `app/api/groups/route.ts:29`
- `lib/use-profile-check.ts:28`
- `app/group/[id]/page.tsx:73`

**Pattern B — `.trim().toLowerCase()`:**
- `lib/api-utils.ts:11`
- `lib/profile.ts:35,40`
- `lib/export.ts:31`

**Pattern C — `String(x).trim().toLowerCase()` (defensive):**
- `app/api/expenses/route.ts:44`
- `app/api/groups/join/route.ts:79-80`
- `app/api/groups/route.ts:83`

**Pattern D — `String(x ?? "").toLowerCase()` (defensive no trim):**
- `app/api/expenses/[id]/route.ts:44,49,103,108`
- `app/api/settlements/route.ts:32,37`
- `app/api/groups/[id]/route.ts:33,88,119,271`

**Consolidation:** Create `normalizeAddress(address: unknown): string` in `lib/wallet.ts` that handles null, undefined, `String()` wrapping, trim, and lowercase. Replace all inline usages.

---

### 1.5 `memberWalletMap` — REIMPLEMENTED in API routes (copies of the same loop)

**Severity: HIGH**

`lib/members.ts:142-151` already exports:
```typescript
export function memberWalletMap(members: Member[]): Record<string, string> {
  return Object.fromEntries(
    members.filter(m => m.walletAddress)
      .flatMap(m => [[m.displayName, m.walletAddress], [m.id, m.walletAddress]])
  );
}
```

But API routes reimplement the same loop inline:

| Location | Lines |
|----------|-------|
| `app/api/groups/route.ts:73-80` | 8 |
| `app/api/groups/[id]/route.ts:110-115` | 6 |
| `app/api/groups/[id]/route.ts:149-156` | 8 |
| `app/api/groups/[id]/route.ts:196-202` | 7 |
| `app/api/groups/join/route.ts:67-74` | 8 |
| `app/api/demo/route.ts:36-42` | 7 |

**Consolidation:** Import and call `memberWalletMap()` in all 6 locations. Deletes ~40 lines of duplicate loops.

---

### 1.6 `createMember` — REIMPLEMENTED in API routes

**Severity: MEDIUM**

`lib/members.ts:50-64` exports `createMember(displayName, walletAddress, avatarColor, createdAt)`.

But API routes construct Member objects inline:

| Location | Lines |
|----------|-------|
| `app/api/groups/route.ts:58-66` | 9 |
| `app/api/groups/[id]/route.ts:100-108` | 9 |
| `app/api/groups/[id]/route.ts:186-194` | 9 |
| `app/api/groups/join/route.ts:55-63` | 9 |
| `app/api/demo/route.ts:28-34` | 7 |

**Consolidation:** Use `createMember()` from `lib/members.ts` in all API route locations. If server needs different defaults, add parameters rather than inlining.

---

## 2. Duplicate API Logic

### 2.1 Zod Validation Schemas — PARTIALLY OVERLAPPING

**Severity: MEDIUM**

| Schema | File | Lines |
|--------|------|-------|
| `createGroupSchema` | `app/api/groups/route.ts:6-15` | 10 |
| `updateGroupSchema` | `app/api/groups/[id]/route.ts:14-22` | 9 |
| `createExpenseSchema` | `app/api/expenses/route.ts:6-24` | 19 |
| `updateExpenseSchema` | `app/api/expenses/[id]/route.ts:6-15` | 10 |
| `upsertProfileSchema` | `app/api/profiles/route.ts:6-10` | 5 |
| `patchProfileSchema` | `app/api/profiles/route.ts:12-19` | 8 |

**Overlap:**
- Group schemas share `name`, `description`, `currency`, `members`, `memberWallets`, `templateType` validation
- Expense schemas share `category` enum: `["food","transport","accommodation","entertainment","utilities","other"]` — also duplicated in `lib/types.ts:94-100` and `lib/calculations.ts:108-115` (as map keys)
- Profile schemas share `displayName`, `avatarURL`, `walletAddress`

**Consolidation:** Create `lib/schemas.ts` with:
- `EXPENSE_CATEGORIES = ["food","transport","accommodation","entertainment","utilities","other"] as const`
- `groupBaseSchema` → extended by `createGroupSchema` / `updateGroupSchema`
- `profileBaseSchema` → extended by `upsertProfileSchema` / `patchProfileSchema`

---

### 2.2 Group Membership Auth Checks — 6 copies of the same block

**Severity: HIGH**

This exact pattern appears in 5 locations:

```typescript
const createdBy = String(groupData.createdBy ?? "").toLowerCase();
const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];
const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];

if (createdBy !== auth.walletAddress && !memberAddresses.includes(auth.walletAddress) &&
    !members.some((m) => String(m.walletAddress ?? "").toLowerCase() === auth.walletAddress)) {
  return errorResponse("You are not a member of this group.", 403);
}
```

| Location | Lines |
|----------|-------|
| `app/api/expenses/route.ts:38-47` | 10 |
| `app/api/expenses/[id]/route.ts:44-51` (PATCH) | 8 |
| `app/api/expenses/[id]/route.ts:103-110` (DELETE) | 8 |
| `app/api/settlements/route.ts:32-39` | 8 |
| `app/api/activity/route.ts:26-31` | 6 (missing the `members.some()` fallback — inconsistent) |

Owner-only check (different pattern, also duplicated):
| Location | Lines |
|----------|-------|
| `app/api/groups/[id]/route.ts:88-90` (PATCH) | 3 |
| `app/api/groups/[id]/route.ts:271-273` (DELETE) | 3 |

**Consolidation:** Add to `lib/api-utils.ts`:
- `assertGroupMembership(groupSnap, authWallet): void` — throws 403 if not member
- `assertGroupOwner(group, authWallet): void` — throws 403 if not owner

---

### 2.3 ZodError Catch Block — 9 copies

**Severity: HIGH**

```typescript
if (error instanceof z.ZodError) {
  return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
}
```

| Location | Lines |
|----------|-------|
| `app/api/groups/route.ts:122-124` | 3 |
| `app/api/groups/[id]/route.ts:255-257` | 3 |
| `app/api/groups/join/route.ts:141-143` | 3 |
| `app/api/expenses/route.ts:105-107` | 3 |
| `app/api/expenses/[id]/route.ts:79-81` | 3 |
| `app/api/settlements/route.ts:125-127` | 3 |
| `app/api/profiles/route.ts:92-94` | 3 |
| `app/api/profiles/route.ts:144-146` | 3 |
| `app/api/activity/route.ts:44-46` | 3 |

**Consolidation:** Add `handleZodError(error): NextResponse | null` to `lib/api-utils.ts`.

---

### 2.4 Group Fetch + Auth Extraction — 5 copies

**Severity: HIGH**

The pattern of `fetch group → check exists → extract createdBy/memberAddresses/members` is duplicated:

| Location | Lines |
|----------|-------|
| `app/api/expenses/route.ts:32-40` | 9 |
| `app/api/expenses/[id]/route.ts:39-46` | 8 |
| `app/api/expenses/[id]/route.ts:98-105` | 8 |
| `app/api/settlements/route.ts:27-34` | 8 |
| `app/api/activity/route.ts:20-27` | 8 |

`app/api/groups/[id]/route.ts:24-30` has its own `getGroupOrThrow()` but doesn't extract auth fields.

**Consolidation:** Create `fetchGroupWithAuth(groupId)` in `lib/api-utils.ts`.

---

### 2.5 Activity Log Creation — 17+ instances

**Severity: HIGH**

```typescript
await adminDb.collection("groups").doc(groupId).collection("activity").add({
  groupId, eventType, actorName, description, metadata, createdAt: serverTimestamp()
});
```

| File | Count |
|------|-------|
| `app/api/groups/route.ts` | 2 |
| `app/api/groups/[id]/route.ts` | 6 |
| `app/api/groups/[id]/route.ts` (DELETE) | 1 |
| `app/api/groups/join/route.ts` | 3 |
| `app/api/expenses/route.ts` | 1 |
| `app/api/expenses/[id]/route.ts` | 1 |
| `app/api/settlements/route.ts` | 2 |
| `app/api/demo/route.ts` | 2 |

Note: `lib/db.ts:175-194` has `addActivityRecord()` but it calls the `/api/activity` endpoint — a circular call from the API routes. API routes need a direct Firestore version.

**Consolidation:** Create `addActivity(groupId, eventType, description, metadata, actorName?)` in `lib/firebase-admin.ts`.

---

### 2.6 `generateInviteCode` — 2 copies

| Location | Lines |
|----------|-------|
| `app/api/groups/route.ts:17-26` | 10 |
| `lib/db.ts:232-240` | 9 |

**Overlap:** Same algorithm: 8 alphanumeric chars from `crypto.getRandomValues`.

**Consolidation:** Export from `lib/db.ts`, import in `groups/route.ts`.

---

### 2.7 Wallet-to-Profile Resolution — 2 copies

| Location | Function | Lines |
|----------|----------|-------|
| `app/api/groups/route.ts:28-47` | `getProfileIdForWallet` | 20 |
| `app/api/profiles/route.ts:21-45` | `readOrMigrateProfile` | 25 |

**Overlap:** Both check `walletLinks/{address}` doc, then fall back to `users/{address}`. Profiles version also migrates.

**Consolidation:** Extract `resolveProfileId(walletAddress)` to `lib/firebase-admin.ts`.

---

### 2.8 Group Response Mapping — 3 copies

| Location | Lines |
|----------|-------|
| `lib/db.ts:49-68` | 20 |
| `app/api/groups/route.ts:148-164` | 17 |
| `app/api/groups/[id]/route.ts:59-73` | 15 |

**Overlap:** All build the same `{ id, name, description, members, memberWallets, currency, createdAt, ... }` group response object.

**Consolidation:** Create `mapGroupResponse(data)` in `lib/firebase-admin.ts`.

---

## 3. Duplicate Business Logic

### 3.1 Settlement Key Generation — 3 copies

| Location | Lines |
|----------|-------|
| `lib/arc-payments.ts:38-42` | 5 — canonical `createSettlementKey()` |
| `lib/db.ts:135-137` | 3 — inline: `` encodeURIComponent(`${data.from}__${data.to}__${amount.toFixed(2)}`) `` |
| `app/api/settlements/route.ts:149` | 1 — same inline pattern |

**Consolidation:** Import `createSettlementKey` from `lib/arc-payments.ts` in the other two locations.

---

### 3.2 Settlement Payment Execution Flow — 2 copies

**Severity: HIGH**

Both `SettlementPaymentButton.tsx` and `SettleAllModal.tsx` repeat the same chain-switch + payment flow:

**Chain switch (identical):**
| Location | Lines |
|----------|-------|
| `components/SettlementPaymentButton.tsx:79-86` | 8 |
| `components/SettleAllModal.tsx:78-86` | 9 |

```typescript
if (Number(chainId) !== ARC_TESTNET_ID) {
  try { await switchChainAsync({ chainId: ARC_TESTNET_ID }); }
  catch { await addArcTestnetToInjectedWallet(); await switchChainAsync({ chainId: ARC_TESTNET_ID }); }
}
```

**Payment execution (nearly identical):**
| Location | Lines |
|----------|-------|
| `components/SettlementPaymentButton.tsx:88-138` | 51 |
| `components/SettleAllModal.tsx:88-149` | 62 |

Both follow: `upsert pending → transferArcToken → upsert paid → error handling`.

**Consolidation:** Extract `executeOnChainSettlement(payment, group)` into `lib/arc-payments.ts`.

---

### 3.3 Balance Adjustment for Paid Settlements — 2 copies

| Location | Lines |
|----------|-------|
| `app/group/[id]/page.tsx:346-356 + 390-397` | ~20 |
| `app/report/[groupId]/page.tsx:175-195` | ~21 |

**Overlap:** Both calculate `paidSettlementAdjustments` map from `completedPayments`, then compute `adjustedBalances = balances.map(b => ({ member, net: b.net + adjustment }))`.

**Consolidation:** Extract `computeAdjustedBalances(balances, completedPayments)` to `lib/calculations.ts`.

---

### 3.4 Recurring Expense Payload Construction — 2 copies

| Location | Lines |
|----------|-------|
| `lib/recurrence.ts:51-68` | 18 |
| `app/api/expenses/route.ts:49-73` | 25 |

**Overlap:** Both construct the same expense document field set: `description, amount, paidBy, splitAmong, category, notes, date, originalCurrency, baseUsdAmount, baseEurAmount, fxRate`.

**Consolidation:** Create `buildExpensePayload(input)` in `lib/db.ts` and reuse from `lib/recurrence.ts`.

---

### 3.5 Member Data Mapping (raw Firestore → Member) — 6 copies

**Severity: HIGH**

| Location | Lines |
|----------|-------|
| `lib/members.ts:83-136` | 54 — canonical `normalizeMembers()` |
| `lib/notifications.ts:46-53` | 8 — inline `getGroupMembers()` |
| `app/api/groups/route.ts:58-66` | 9 |
| `app/api/groups/[id]/route.ts:100-108` | 9 |
| `app/api/groups/[id]/route.ts:186-194` | 9 |
| `app/api/groups/join/route.ts:55-63` | 9 |

**Consolidation:** Use `normalizeMembers()` (or `createMember()`) from `lib/members.ts` in all API routes. The `notifications.ts:getGroupMembers()` can also delegate to `normalizeMembers()`.

---

### 3.6 `getGroupMembers` in notifications.ts — reimplements members.ts

| Location | Lines |
|----------|-------|
| `lib/notifications.ts:39-58` | 20 |
| `lib/members.ts:83-136` | 54 |

**Overlap:** Both read raw member data and construct `Member[]`. The notifications version is simpler (no legacy string migration, no ID dedup) but the core field mapping is the same.

**Consolidation:** Replace `getGroupMembers` body with a call to `normalizeMembers()` from `members.ts`.

---

### 3.7 Member display name lookup — 2 copies

| Location | Lines |
|----------|-------|
| `lib/members.ts:153-157` | 5 — `findMember()` by id or displayName |
| `lib/export.ts:31-33` | 3 — `memberDisplayName()` by wallet or displayName |

**Consolidation:** Extend `findMember` to support wallet address lookup, or create `findMemberByWallet` in `members.ts`.

---

## 4. Duplicate Data Transformations

### 4.1 Date Formatting — 2 duplicate function sets + 8 inline sites

**Severity: HIGH**

Duplicate function definitions:

| Function | `app/report/[groupId]/page.tsx` | `app/group/[id]/page.tsx` |
|----------|-------------------------------|--------------------------|
| `formatDate()` | Lines 21-24 | Lines 1886-1888 |
| `formatDateTime()` | Lines 27-32 | Lines 1890-1898 |
| `groupActivityByDate()` | Lines 34-43 | Lines 1900-1912 |
| `activityIcon()` | Lines 45-56 | Lines 1914-1925 |
| `activityIconBackground()` | Lines 58-63 | Lines 1931-1936 |
| `activityIconColor()` | Lines 65-70 | Lines 1938-1943 |
| `activityShortType()` | Lines 72-74 | Lines 1945-1947 |

That's **7 functions × 2 files = ~60 lines of exact duplicates**.

Additional inline formatting sites:
| Location | Pattern |
|----------|---------|
| `app/page.tsx:270,472` | `toLocaleDateString("en-US", { month: "short", day: "numeric" })` |
| `components/NotificationBell.tsx:17` | Same `toLocaleDateString` pattern |
| `components/AddExpenseModal.tsx:35` | `new Date(value).toISOString().slice(0, 10)` |
| `lib/export.ts:20,40,55,120,129,184,208` | Multiple date patterns |

**Consolidation:** Create `lib/date-utils.ts`:
- `formatDate(ts): string`
- `formatDateTime(ts): string`
- `formatDateForInput(ts): string` (for `<input type="date">`)
- `groupActivityByDate(records): Map<string, ActivityRecord[]>`

---

### 4.2 Amount / Money Formatting — 55+ inline `toFixed(2)` sites

**Severity: HIGH**

The pattern `${currency} ${amount.toFixed(2)}` or similar appears:

| File | Approximate count |
|------|-------------------|
| `app/group/[id]/page.tsx` | 20+ |
| `app/page.tsx` | 13 |
| `app/report/[groupId]/page.tsx` | 8 |
| `lib/export.ts` | 10 |
| `components/SettleAllModal.tsx` | 4 |
| `components/SettlementPaymentButton.tsx` | 3 |

No standard formatting function exists. Each file does `toFixed(2)` inline with currency symbols hardcoded.

**Consolidation:** Create `lib/format.ts`:
- `formatAmount(amount: number, currency: string): string` → `"$12.34"`
- `formatAmountWithSign(amount: number, currency: string): string` → `"+$12.34"` / `"-$12.34"`

---

### 4.3 Cent Conversion — internal-only, not duplicated but notable

`lib/calculations.ts:6-12` has `toCents()` and `fromCents()`. These are the canonical precision helpers. Not duplicated, but the display layer ignores them and uses `toFixed(2)` directly (see 4.2).

---

### 4.4 Expense Data Mapping — 3 copies

| Location | Lines |
|----------|-------|
| `lib/db.ts:98-128` | 31 — canonical `mapExpense()` |
| `app/api/expenses/route.ts:49-73` | 25 — server-side payload |
| `lib/recurrence.ts:51-68` | 18 — recurring expense payload |

**Consolidation:** Create `buildExpenseDocument(input)` in `lib/db.ts` to share field construction.

---

### 4.5 `memberAddresses` extraction — 4 copies

| Location | Lines |
|----------|-------|
| `app/api/groups/route.ts:82-84` | 3 |
| `app/api/groups/[id]/route.ts:117-121` | 5 |
| `app/api/groups/join/route.ts:76-82` | 7 |
| `app/api/demo/route.ts:44-46` | 3 |

**Overlap:** Extract unique wallet addresses from members array.

**Consolidation:** Create `extractMemberAddresses(members)` in `lib/members.ts`.

---

### 4.6 Error Message Extraction Pattern — 50+ sites

The same `error instanceof Error ? error.message : String(error)` ternary appears in:
- `lib/db.ts:37` (inside `logFirestoreError`)
- `lib/api-utils.ts:30` (inside `handleError`)
- ~50 try/catch blocks across `lib/notifications.ts`, `lib/profile.ts`, `lib/db.ts`, `lib/image-upload.ts`, etc.

The specific pattern isn't a code clone, but the error handling structure is repeated enough to benefit from a shared utility like `lib/errors.ts`:
- `safeExtractMessage(error): string`
- `logError(context: string, error: unknown): void`

---

## 5. Duplicate React Patterns

### 5.1 Modal Backdrop + Container — 7 copies of the same CSS-in-JS

**Severity: HIGH**

Only `ConfirmModal` uses the shared `components/ui/Modal.tsx`. All others reinvent the same inline modal:

| File | Backdrop lines | Container lines |
|------|---------------|-----------------|
| `components/AddExpenseModal.tsx:121-131` | 11 | 25 |
| `components/SettleAllModal.tsx:154-163` | 10 | 21 |
| `components/ExportModal.tsx:66-67` | 2 | 2 |
| `components/GroupSettingsModal.tsx:135-145` | 11 | 26 |
| `components/MemberWalletModal.tsx:66-76` | 11 | 25 |
| `app/group/[id]/page.tsx` ExpenseDetailsModal (~1507) | 11 | 22 |
| `app/group/[id]/page.tsx` ActivityPanel (~1592) | 10 | 15 |

**Identical patterns across all:**
- Backdrop: `position: "fixed", inset: 0, zIndex: 100, backdropFilter: "blur(4px)", background: "rgba(0,0,0,0.4)"`
- Container: `position: "fixed", inset: 0, zIndex: 101, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto"`
- Close button: inline SVG × with `onClick(onClose)`
- Header: `padding: "1.5rem 1.75rem 1.25rem"`, `borderBottom`, `display: "flex", justifyContent: "space-between"`
- Footer: `padding: "1.25rem 1.75rem"`, `borderTop`, `display: "flex", justifyContent: "flex-end"`, Cancel + action buttons

**Consolidation:** Refactor all modals to use `components/ui/Modal.tsx`. It already exists and is properly designed for this.

---

### 5.2 Image Upload — 2 nearly identical components

| Aspect | `GroupImageUpload.tsx` | `ProfileAvatarUpload.tsx` |
|--------|----------------------|--------------------------|
| Lines | 99 | 100 |
| `handleSelect` | Lines 17-29 | Lines 17-29 |
| `handleRemove` | Lines 31-35 | Lines 31-35 |
| Container layout | `display: "flex", alignItems: "center", gap: "1rem"` | Same |
| Upload overlay | `inset: 0, background: rgba(0,0,0,0.3)` | Same |
| Hover border | `onMouseEnter/onMouseLeave` | Same |
| File input accept | `image/jpeg,image/png,image/webp` | Same |
| Remove button | Lines 83-85 | Lines 81-83 |

**Differences:** Size (64×64 vs 80×80), shape (rect vs circle), initials logic.

**Consolidation:** Merge into parameterized `ImageUpload({ shape, size, label, initials })`.

---

### 5.3 "Use Connected Wallet" Button — 4 copies

| Location | Lines | Button Text |
|----------|-------|-------------|
| `components/GroupSettingsModal.tsx:336-368` | 33 | "Use mine" |
| `components/MemberWalletModal.tsx:174-189` | 16 | "Use Connected Wallet" |
| `app/create/page.tsx:381-395` | 15 | "Use mine" |
| `app/profile/page.tsx:230-239` | 10 | "Use connected" |

All do: `const { address, isConnected } = useAccount(); if (isConnected && address) render button → onClick(() => onUse(address))`.

**Consolidation:** Extract `FillWalletButton({ onUse })` component.

---

### 5.4 `WalletBadge` Component — 2 copies

| Location | Lines |
|----------|-------|
| `components/GroupSettingsModal.tsx:281-308` | 28 |
| `app/group/[id]/page.tsx:1475-1502` | 28 |

Both render: `shortenAddress(wallet)`, click-to-copy icon, "No wallet" fallback.

**Consolidation:** Extract shared `WalletBadge` component.

---

### 5.5 Activity Feed Helpers — 7 functions × 2 copies (14 duplicates)

All defined identically in both files:

| Function | Group page | Report page |
|----------|-----------|-------------|
| `activityIcon()` | `app/group/[id]/page.tsx:1914-1925` | `app/report/[groupId]/page.tsx:45-56` |
| `activityIconBackground()` | :1931-1936 | :58-63 |
| `activityIconColor()` | :1938-1943 | :65-70 |
| `activityShortType()` | :1945-1947 | :72-74 |
| `groupActivityByDate()` | :1900-1912 | :34-43 |
| `formatDateTime()` | :1890-1898 | :27-32 |

**Consolidation:** Extract to `lib/activity-helpers.ts`.

---

### 5.6 `avatarColor` Function — 2 copies (bypassing the shared version)

| Location | Lines |
|----------|-------|
| `app/page.tsx:258-263` | 6 |
| `app/group/[id]/page.tsx:228-233` | 6 |

Both define inline `getAvatarColor(seed)` instead of importing the already-exported version from `lib/members.ts:39-41`.

---

### 5.7 Error Banner Pattern — 7+ copies

| Location | Lines |
|----------|-------|
| `components/AddExpenseModal.tsx:436-448` | 13 |
| `components/GroupSettingsModal.tsx:254` | 1 |
| `components/MemberWalletModal.tsx:154-157` | 4 |
| `components/ExportModal.tsx:89-93` | 5 |
| `app/page.tsx:315-323` | 9 |
| `app/create/page.tsx:349-362` | 14 |
| `app/profile/page.tsx:168-177` | 10 |

Pattern: `padding: "0.75rem 1rem"`, `background: "var(--red-light)"`, `border: "1px solid var(--error-border)"`, `borderRadius: 8`, red text.

**Consolidation:** Extract `AlertBanner({ message })` component.

---

### 5.8 Back Link Pattern — 3 copies

| Location | Lines |
|----------|-------|
| `app/group/[id]/page.tsx:403-406` | 4 |
| `app/create/page.tsx:116-119` | 4 |
| `app/profile/page.tsx:163-166` | 4 |

All: `display: "inline-flex", alignItems: "center", gap: "0.375rem"` with SVG chevron.

**Consolidation:** Extract `BackLink({ href })` component.

---

### 5.9 Segment Button Toggle Pattern — 3 copies

| Location | Lines |
|----------|-------|
| `components/AddExpenseModal.tsx:195-224` | 30 |
| `components/GroupSettingsModal.tsx:207-213` | 7 |
| `app/create/page.tsx:196-215` | 20 |

All use: `padding: "0.375rem 0.875rem"`, `borderRadius: 6`, `border: "1.5px solid var(--border)"`, active = `border: "var(--blue)"` + `background: "var(--blue-light)"`.

**Consolidation:** Extract `SegmentedControl({ options, value, onChange })`.

---

### 5.10 Filter Button Chips — 4 copies in one file

| File | Lines |
|------|-------|
| `app/group/[id]/page.tsx:736-749` | 14 |
| `app/group/[id]/page.tsx:755-773` | 19 |
| `app/group/[id]/page.tsx:779-793` | 15 |
| `app/group/[id]/page.tsx:800-819` | 20 |

Same pattern: `padding: "0.3rem 0.7rem"`, `borderRadius: 999`, `background: selected ? "var(--blue)" : "var(--surface-2)"`.

**Consolidation:** Extract `FilterChip({ label, selected, onClick })` component.

---

### 5.11 Demo Badge SVG — 2 copies

| Location | Lines |
|----------|-------|
| `app/page.tsx:429-433` | 5 |
| `app/group/[id]/page.tsx:437-444` | 8 |

Same star SVG + "Demo" label.

**Consolidation:** Extract `DemoBadge` component.

---

### 5.12 Stat Card Grid — 3 copies

| Location | Lines |
|----------|-------|
| `app/page.tsx:327-372` | 46 |
| `app/group/[id]/page.tsx:483-505` | 23 |
| `app/group/[id]/page.tsx:562-588` | 27 |
| `app/report/[groupId]/page.tsx:238-259` | 22 |

All render stat cards with icon container, value, and label in a CSS grid.

**Consolidation:** Extract `StatCard({ icon, value, label })` and `StatCardGrid({ cards })`.

---

### 5.13 Balance Rendering — 3 copies

| Location | Color scheme |
|----------|-------------|
| `app/page.tsx:498-527` | green (+), red (−), neutral |
| `app/group/[id]/page.tsx:1057-1099` | Same |
| `app/report/[groupId]/page.tsx:306-343` | Same |

All render member balances with sign coloring and currency formatting.

**Consolidation:** Extract `BalanceList({ balances, currency })` component.

---

### 5.14 Settlement List Rendering — 2 copies

| Location | Lines |
|----------|-------|
| `app/group/[id]/page.tsx:1170-1297` | 128 |
| `app/report/[groupId]/page.tsx:274-287` | 14 (simpler) |

**Consolidation:** Extract `SettlementList({ settlements, memberNames })` component.

---

## 6. Consolidated Priority Matrix

| Priority | Cluster | Impact | Effort |
|----------|---------|--------|--------|
| **P0** | `toMillis` (4 defs + 4 inline) | Timestamp bugs from inconsistent conversion | Low |
| **P0** | Group membership auth check (6 copies) | Security risk from inconsistent checks | Low |
| **P0** | `memberWalletMap` reimplemented in 6 API routes | ~40 lines, easy win | Low |
| **P0** | Modal inline CSS-in-JS (7 sites, ~300 lines) | Heavy maintenance burden | Medium |
| **P1** | ZodError catch block (9 copies) | ~27 lines, easy win | Low |
| **P1** | Activity feed helpers (7 × 2 copies) | ~60 lines, straightforward extract | Low |
| **P1** | Payment execution flow (2 copies) | ~120 lines, high complexity | Medium |
| **P1** | Address normalization (15+ inline) | Inconsistent behavior across app | Low |
| **P2** | Amount formatting (55+ sites) | ~90% of files use `toFixed(2)` inline | Medium |
| **P2** | Zod schemas (partial overlap) | 6 schemas share base fields | Low |
| **P2** | Date formatting (7 × 2 copies + 8 inline) | ~40 lines extract + replace | Low |
| **P2** | Image upload (2 × 100 lines) | 90% identical, easy parameterization | Medium |
| **P3** | "Use wallet" button (4 copies) | ~15 lines each | Low |
| **P3** | Error banner (7 copies) | ~10 lines each | Low |
| **P3** | Filter chips (4 copies in one file) | ~68 lines, easy component | Low |
| **P3** | Back link (3 copies) | ~12 lines | Low |
| **P3** | Demo badge (2 copies) | ~13 lines | Low |
| **P3** | Wallet badge (2 copies) | ~56 lines | Low |
| **P3** | Segment toggle (3 copies) | ~57 lines | Low |
| **P3** | Stat card grid (3 copies) | ~100 lines | Medium |

---

## 7. Suggested Consolidation Targets

### New Files to Create

| File | Contents |
|------|----------|
| `lib/timestamp.ts` | `toMillis()` — single canonical version |
| `lib/wallet.ts` | `normalizeAddress()`, `validateEvmAddress()` (canonicalize), `shortenAddress()` (canonicalize) |
| `lib/format.ts` | `formatAmount()`, `formatAmountWithSign()` |
| `lib/date-utils.ts` | `formatDate()`, `formatDateTime()`, `formatDateForInput()`, `groupActivityByDate()` |
| `lib/activity-helpers.ts` | `activityIcon()`, `activityIconBackground()`, `activityIconColor()`, `activityShortType()`, `formatDateTime()` |
| `lib/schemas.ts` | `EXPENSE_CATEGORIES`, `groupBaseSchema`, `profileBaseSchema` |
| `lib/errors.ts` | `safeExtractMessage()`, `logError()` |
| `components/ui/AlertBanner.tsx` | Shared error/info banner |
| `components/ui/BackLink.tsx` | Shared back navigation |
| `components/ui/DemoBadge.tsx` | Shared demo indicator |
| `components/ui/FilterChip.tsx` | Shared filter toggle button |
| `components/ui/SegmentedControl.tsx` | Shared segment button group |
| `components/ui/StatCard.tsx` | Shared stat display card |
| `components/ui/FillWalletButton.tsx` | Shared "use connected wallet" button |
| `components/ui/WalletBadge.tsx` | Shared wallet address badge with copy |

### Existing Files to Extend

| File | Add |
|------|-----|
| `lib/api-utils.ts` | `assertGroupMembership()`, `assertGroupOwner()`, `fetchGroupWithAuth()`, `handleZodError()`, `parseBody()` |
| `lib/arc-payments.ts` | `executeOnChainSettlement()` |
| `lib/calculations.ts` | `computeAdjustedBalances()` |
| `lib/members.ts` | `extractMemberAddresses()`, extend `findMember()` for wallet lookup |
| `lib/db.ts` | Export `generateInviteCode()`, `buildExpensePayload()` |
| `lib/firebase-admin.ts` | `addActivity()`, `resolveProfileId()`, `mapGroupResponse()` |
| `components/ui/Modal.tsx` | Use it from all inline modals |

### Files to Remove After Consolidation

| File | Reason |
|------|--------|
| `components/ui/Button.tsx` | Unused entirely |
| `components/ui/index.ts` | Barrel file, never imported |
| `lib/wallet-empty-accounts.ts` | Empty stub |
| `stable/` | Legacy duplicate of `functions/` |
