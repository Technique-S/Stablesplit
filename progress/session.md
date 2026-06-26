# Session: Groups not loading after bridge feature

## Date
2026-06-26

## Problem
User reports "groups could not be loaded" — groups fail to display on dashboard and group detail pages.

## Timeline
- Architecture reorganization committed (`313e3aa phase3: architecture reorganization`)
- Bridge feature implemented as working-tree changes (untracked + modified files)
- User noticed groups stopped loading

## Root Cause Analysis

### Committed code (HEAD `313e3aa`) — BROKEN
- `lib/client/profile.ts` uses **direct Firestore client reads** (`getDoc`) for `getProfileByWalletAddress`
- Firestore security rules (`firestore.rules`) require `request.auth != null` for ALL reads
- App **never initializes Firebase Auth** — no `getAuth()`, `signInAnonymously`, or any auth mechanism
- Result: `getProfileByWalletAddress` → security rules deny → catches error → returns `null` → dashboard returns early → no groups loaded
- Group detail page `onSnapshot` at `app/group/[id]/page.tsx:134-148` also fails → shows "Group could not be loaded."

### Working tree (uncommitted) — FIXES
- `lib/client/profile.ts` migration from direct Firestore reads → API route calls (`apiRequest("GET", "/api/profiles", ...)`)
- `app/api/profiles/route.ts` — new `GET` handler using Admin SDK (bypasses security rules)
- These changes are uncommitted and were never deployed

### Key finding
The bridge feature implementation included the profile→API migration as part of the same batch of work. The deployed (committed) code has the broken direct-read version. The uncommitted changes contain the fix.

## Files Changed (modified/untracked)

### Core functional changes
- `lib/client/profile.ts` (modified) — direct reads → API routes
- `app/api/profiles/route.ts` (modified) — added GET handler
- `app/api/groups/route.ts` (modified) — safeRandomUUID, debug logging
- `app/api/groups/[id]/route.ts` (modified) — minor fixes
- `lib/use-profile-check.ts` (modified) — debug logging
- `lib/server/crypto-utils.ts` (new/untracked) — safe random UUID/invite code
- `lib/server/firebase-admin.ts` (modified) — health check, debug logging
- `lib/server/api-utils.ts` (modified)

### Bridge feature
- `lib/web3/bridge-kit.ts` (new/untracked) — Circle AppKit bridge
- `app/bridge/page.tsx` (new/untracked) — bridge UI
- `components/expense/SettlementPaymentButton.tsx` (modified) — balance check + bridge link
- `components/layout/Navbar.tsx` (modified) — cosmetic
- `package.json` (modified) — added `@circle-fin/app-kit`, `@circle-fin/adapter-viem-v2`
- `pnpm-workspace.yaml` (modified) — added `bufferutil`, `utf-8-validate`

### Cosmetic
- `app/page.tsx` (modified) — CSS class cleanup
- `app/group/[id]/page.tsx` (modified) — SVG icons, WalletBadge
- `app/globals.css` (modified) — CSS changes
- `components/shared/WalletBadge.tsx` (new/untracked)

## Key Decision
- Fix is to deploy the uncommitted changes in `lib/client/profile.ts` and `app/api/profiles/route.ts` which migrate profile reads from direct Firestore to API routes (Admin SDK)
- This is a pre-existing architectural issue: security rules require auth but app never initializes Firebase Auth

## Next Steps
- Commit and deploy the working tree changes
- Verify profile loading works via API routes
- Verify group loading works on dashboard and group pages
