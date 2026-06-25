# Phase 1 Changelog — Safe Cleanup

**Date:** 2026-06-25

**Verification:** `pnpm build` — compiles successfully. Zero new warnings. All routes and pages generated.

---

## 1. Deleted Unused Files (10)

| File | Reason |
|------|--------|
| `components/ui/Button.tsx` | Unused component — zero JSX usage, never imported |
| `components/ui/index.ts` | Unused barrel file — all consumers import `@/components/ui/Modal`, `@/components/ui/Toast`, etc. directly |
| `lib/wallet-empty-accounts.ts` | Empty stub (`export {};`) — never imported |
| `public/file.svg` | Default Next.js boilerplate — unreferenced |
| `public/globe.svg` | Default Next.js boilerplate — unreferenced |
| `public/next.svg` | Default Next.js boilerplate — unreferenced |
| `public/vercel.svg` | Default Next.js boilerplate — unreferenced |
| `public/window.svg` | Default Next.js boilerplate — unreferenced |
| `stable/index.js` | Legacy Cloud Functions duplicate — not a workspace member, not referenced |
| `stable/package.json` | Legacy package — not referenced by any project config |
| `stable/package-lock.json` | Associated lockfile |
| `stable/.gitignore` | Associated gitignore |

---

## 2. Removed Unused Exports (fully deleted — never called)

| File | Export | Action |
|------|--------|--------|
| `lib/db.ts` | `getAllGroups()` | Deleted — never called. Fetches ALL groups with no auth (security risk). |
| `lib/db.ts` | `addMemberToGroup()` | Deleted — never called |
| `lib/db.ts` | `addExpense()` | Deleted — callers use `createExpense()` directly |
| `lib/profile.ts` | `updateProfileDisplayName()` | Deleted — never called |
| `lib/profile.ts` | `updateProfileWallet()` | Deleted — never called |
| `lib/recurrence.ts` | `formatRecurrenceDescription()` | Deleted — never called |
| `lib/image-upload.ts` | `revokeObjectURL()` | Deleted — never called (native `URL.revokeObjectURL()` used directly in `export.ts`) |
| `lib/calculations.ts` | `CATEGORY_COLORS` | Deleted — never imported (only `CATEGORY_ICONS` and `CATEGORY_BACKGROUNDS` are used) |

---

## 3. Made Private (removed `export` — kept internal usage)

| File | Export | Used Internally By |
|------|--------|-------------------|
| `lib/db.ts` | `toMillis()` | `mapGroup`, `mapExpense`, `mapSettlementPayment`, `mapActivityRecord` |
| `lib/profile.ts` | `toMillis()` | `mapUserProfile` |
| `lib/notifications.ts` | `toMillis()` | `mapNotification` |
| `lib/notifications.ts` | `getUnreadNotifications()` | `markAllNotificationsAsRead` |
| `lib/members.ts` | `normalizeWalletAddress()` | `normalizeMembers` |
| `lib/members.ts` | `findMember()` | `getMemberWallet` |
| `lib/rates.ts` | `fetchRates()` | `getRates` |
| `components/ui/Skeleton.tsx` | `Skeleton` | `CardSkeleton` |
| `components/ui/Toast.tsx` | `useToast()` | Defined but no consumer exists — kept as private for potential future use |
| `components/FloatingActionMenu.tsx` | `FabAction` interface | Used as internal parameter type |
| `lib/api-utils.ts` | `AuthResult` type | Used as internal return type of `verifyAuth` |

---

## 4. Removed Unused Imports

| File | Removed Imports |
|------|----------------|
| `lib/db.ts` | Removed `notifyGroupMembers`, `notifySpecificMembers` from `"./notifications"` |
| `lib/notifications.ts` | Removed `addDoc`, `Timestamp` from `"firebase/firestore"` |
| `lib/profile.ts` | Removed `setDoc`, `serverTimestamp` from `"firebase/firestore"` |

---

## 5. Removed Unused Dependencies (9 packages)

| Package | Reason |
|---------|--------|
| `@lit/reactive-element` | Lit framework — project uses React |
| `@metamask/connect-evm` | Wallet connection via `@reown/appkit` + `wagmi` |
| `@phosphor-icons/webcomponents` | No usage — project uses `lucide-react` |
| `@walletconnect/ethereum-provider` | WalletConnect handled via `@reown/appkit` transitively |
| `lit` | Full Lit framework unused |
| `lit-element` | Lit sub-package, unused |
| `porto` | No usage |
| `accounts` | Not imported anywhere. Also: |
| `@dataconnect/generated` | Firebase Data Connect — project uses Firestore directly |
| *(build config)* | Removed `accounts` webpack + turbopack alias from `next.config.ts` |

---

## 6. Build Configuration Cleanup

- **`next.config.ts`**: Removed entire `webpack` and `turbopack` config blocks (only contained `accounts` alias). Config is now empty `{}`.

---

## Summary

| Category | Count |
|----------|-------|
| Files deleted | 12 |
| Exports deleted (dead functions) | 8 |
| Exports made private | 11 |
| Unused imports removed | 5 |
| Dependencies removed | 9 |
| Build config simplified | 1 file |

All changes are pure deletion / visibility reduction. Zero behavioral changes. Build verified with `pnpm build`.
