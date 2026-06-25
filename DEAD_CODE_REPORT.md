# Dead Code Report — StableSplit

Generated: 2026-06-25

## Summary

| Category | Count |
|----------|-------|
| Unused files | 10 |
| Unused exports (functions, types, constants) | 17 |
| Unused npm dependencies | 8 |
| Unused directories (boilerplate/legacy) | 3 |

---

## 1. Unused Files

These files can be deleted — nothing imports or references them.

| # | File | Evidence | Confidence |
|---|------|----------|------------|
| 1 | `components/ui/Button.tsx` | Zero imports found via `grep` across entire codebase. No `<Button` JSX usage. Re-exported via `components/ui/index.ts` but barrel file is also never imported. | **HIGH** |
| 2 | `components/ui/index.ts` | Barrel file never imported — all consumers import individual components directly (`@/components/ui/Modal`, `@/components/ui/Toast`, etc.). | **HIGH** |
| 3 | `lib/wallet-empty-accounts.ts` | Contains only `export {};` — empty stub. Never imported anywhere. | **HIGH** |
| 4 | `public/file.svg` | Default Next.js boilerplate. Not referenced in any source file or CSS. | **HIGH** |
| 5 | `public/globe.svg` | Default Next.js boilerplate. Not referenced in any source file or CSS. | **HIGH** |
| 6 | `public/next.svg` | Default Next.js boilerplate. Not referenced in any source file or CSS. | **HIGH** |
| 7 | `public/vercel.svg` | Default Next.js boilerplate. Not referenced in any source file or CSS. | **HIGH** |
| 8 | `public/window.svg` | Default Next.js boilerplate. Not referenced in any source file or CSS. | **HIGH** |
| 9 | `stable/index.js` | Near-identical copy of `functions/src/index.ts`. Not referenced by root `package.json`, `tsconfig.json`, or any source code. | **HIGH** |
| 10 | `stable/package.json` | Standalone `functions` package. Not a workspace member. Not referenced by any project config. | **HIGH** |

---

## 2. Unused Exports (in otherwise-used files)

These exports exist in files that are otherwise used, but the specific export is never imported externally.

### 2.1 Unused Types / Interfaces

| # | File | Export | Evidence | Confidence |
|---|------|--------|----------|------------|
| 1 | `lib/api-utils.ts:3` | `AuthResult` | Only used as return type of `verifyAuth` within same file. Not imported elsewhere. | **HIGH** |
| 2 | `components/FloatingActionMenu.tsx:5` | `FabAction` | Only used as parameter type within same file. Not imported anywhere. | **HIGH** |

### 2.2 Unused Functions

| # | File | Export | Evidence | Confidence |
|---|------|--------|----------|------------|
| 3 | `lib/db.ts:41` | `toMillis` | Called only internally within `db.ts` (by `mapGroup`, `mapExpense`, `mapSettlementPayment`, `mapActivityRecord`). Not imported externally. | **HIGH** |
| 4 | `lib/db.ts:326` | `getAllGroups` | Defined but never called anywhere in the codebase. | **HIGH** |
| 5 | `lib/db.ts:359` | `addMemberToGroup` | Defined but never called anywhere in the codebase. | **HIGH** |
| 6 | `lib/db.ts:404` | `addExpense` | Thin wrapper calling `createExpense`. Never imported externally — `createExpense` is used directly instead. | **HIGH** |
| 7 | `lib/profile.ts:13` | `toMillis` | Called only internally within `profile.ts` (by `mapUserProfile`). Not imported externally. | **HIGH** |
| 8 | `lib/profile.ts:115` | `updateProfileDisplayName` | Defined but never called anywhere. | **HIGH** |
| 9 | `lib/profile.ts:119` | `updateProfileWallet` | Defined but never called anywhere. | **HIGH** |
| 10 | `lib/notifications.ts:18` | `toMillis` | Called only internally within `notifications.ts` (by `mapNotification`). Not imported externally. | **HIGH** |
| 11 | `lib/notifications.ts:167` | `getUnreadNotifications` | Called only internally by `markAllNotificationsAsRead`. Not imported externally. | **HIGH** |
| 12 | `lib/members.ts:66` | `normalizeWalletAddress` | Called only internally within `members.ts` (by `normalizeMembers`). Not imported externally. | **HIGH** |
| 13 | `lib/members.ts:153` | `findMember` | Called only internally within `members.ts` (by `getMemberWallet`). Not imported externally. | **HIGH** |
| 14 | `lib/rates.ts:3` | `fetchRates` | Called only internally within `rates.ts` (by `getRates`). Not imported externally. | **HIGH** |
| 15 | `lib/recurrence.ts:33` | `formatRecurrenceDescription` | Defined but never called anywhere in the codebase. | **HIGH** |
| 16 | `lib/image-upload.ts:64` | `revokeObjectURL` | Defined but never called. Only `URL.revokeObjectURL()` native API called in `export.ts:72`. | **HIGH** |

### 2.3 Unused Constants

| # | File | Export | Evidence | Confidence |
|---|------|--------|----------|------------|
| 17 | `lib/calculations.ts:117` | `CATEGORY_COLORS` | Never imported. Only `CATEGORY_ICONS` and `CATEGORY_BACKGROUNDS` are used by the app. | **HIGH** |
| 18 | `lib/arc-payments.ts` | `ARC_TOKEN_CONTRACTS` | Used only internally within `arc-payments.ts`. Not imported externally. | **HIGH** |
| 19 | `lib/arc-payments.ts` | `ARC_TOKEN_DECIMALS` | Used only internally within `arc-payments.ts`. Not imported externally. | **HIGH** |
| 20 | `lib/wallet.ts` | `ARC_TESTNET_RPC_URL` | Used only internally within `wallet.ts`. Not imported externally. | **HIGH** |
| 21 | `lib/wallet.ts` | `projectId` | Used only internally within `wallet.ts`. Not imported externally. | **HIGH** |
| 22 | `lib/wallet.ts` | `wagmiAdapter` | Used only internally within `wallet.ts`. Not imported externally. | **HIGH** |

### 2.4 Unused Component Exports

| # | File | Export | Evidence | Confidence |
|---|------|--------|----------|------------|
| 23 | `components/ui/Skeleton.tsx:3` | `Skeleton` | Only used internally by `CardSkeleton`. Not imported by any external file. (Consumers import `CardSkeleton`/`ActivitySkeleton` only.) | **HIGH** |
| 24 | `components/ui/Toast.tsx:26` | `useToast` | Never imported by any consumer. No component/page calls it. | **HIGH** |

---

## 3. Unused Dependencies

These packages in `package.json` have no `import` or `require` statements referencing them anywhere in the codebase.

| # | Package | Evidence | Confidence |
|---|---------|----------|------------|
| 1 | `@lit/reactive-element` | No import/require found. Part of Lit framework — project uses React. | **HIGH** |
| 2 | `@metamask/connect-evm` | No import/require found. Wallet connection via `@reown/appkit` + `wagmi`. | **HIGH** |
| 3 | `@phosphor-icons/webcomponents` | No import/require found. No reference to "phosphor" anywhere. Project uses `lucide-react`. | **HIGH** |
| 4 | `@walletconnect/ethereum-provider` | No import/require found. WalletConnect handled via `@reown/appkit` transitively. | **HIGH** |
| 5 | `lit` | No import/require found. Full Lit framework unused. | **HIGH** |
| 6 | `lit-element` | No import/require found. Sub-package of Lit, unused. | **HIGH** |
| 7 | `porto` | No import/require found. | **HIGH** |
| 8 | `accounts` | Listed in `package.json` and aliased in `next.config.ts` but no application code ever imports `"accounts"`. The sole intended consumer `lib/wallet-empty-accounts.ts` is an empty stub. | **HIGH** |

---

## 4. Unused Directories (Boilerplate / Legacy)

| # | Directory | Contents | Evidence | Confidence |
|---|-----------|----------|----------|------------|
| 1 | `dataconnect/` | Firebase Data Connect config files, GraphQL schema, seed data, example queries | The `@dataconnect/generated` dependency in `package.json` is never imported by any application code. Project uses Firestore directly (not Data Connect). | **HIGH** |
| 2 | `src/dataconnect-generated/` | Auto-generated Data Connect SDK (CJS, ESM, React bindings, type defs) | Same as above — referenced in `package.json` but never `import`ed. All references are within the generated files themselves (READMEs, etc.). | **HIGH** |
| 3 | `stable/` | Legacy Cloud Functions in CommonJS (`index.js`, `package.json`, `package-lock.json`) | Duplicate of `functions/src/index.ts`. Not a workspace member, not referenced by any project config. | **HIGH** |

---

## 5. Dead Build Configuration

| # | Item | Location | Evidence | Confidence |
|---|------|----------|----------|------------|
| 1 | `accounts` webpack alias | `next.config.ts` | Alias maps `accounts` → `require.resolve("accounts")` and turbopack alias → `./node_modules/accounts`. No code imports `"accounts"`. The `accounts` dependency can be removed alongside the alias. | **HIGH** |

---

## Notes

- `functions/` directory is **not** dead code — it is a standalone Firebase Cloud Functions project. It is not integrated into the main app's build pipeline, but is independently deployable.
- `lib/db.ts` imports `ExpenseInput`, `GroupInput`, and `SettlementPaymentStatus` from `lib/types.ts` and uses them internally. These are **not** dead — they are narrowly scoped to a single consumer.
- `toMillis` is duplicated across `lib/db.ts`, `lib/profile.ts`, and `lib/notifications.ts` — none of these are imported externally, but each file uses its own copy internally. This is code duplication, not dead code per se.
