---
title: 'Phase 4 Fix Items'
type: 'refactor'
created: '2026-06-26'
status: 'done'
baseline_commit: '313e3aadbe910c38a1f26b7e9e9a682f7f5e6d0b'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Phase 4 self-audit identified four independent issues: the report page uses client-side Firestore with no auth, no pagination exists anywhere (all data loaded client-side), zero test infrastructure, and several polish gaps (duplicate formatTime, missing lint/typecheck scripts, NotificationBell unconditional polling).

**Approach:** Fix all four sequentially — report auth, then pagination, then test scaffold, then polish — verifying each before moving to the next.

## Boundaries & Constraints

**Always:**
- Report auth: convert to server-side API route with `verifyAuth` and `assertGroupMembership` matching existing `app/api/groups/[id]/route.ts` pattern
- Pagination: add `limit` + cursor-based pagination (`startAfter`) to all Firestore queries; keep existing `onSnapshot` for group page but cap with `limit`
- Tests: scaffold vitest (matching Next.js ecosystem) with one smoke test; do not write feature tests
- Deduplicate `formatTime` into `lib/client/format.ts`; import in both consumers
- Add `typecheck` (tsc --noEmit) and `lint` (next lint) scripts to package.json

**Ask First:**
- If pagination page size needs to differ per query type (expenses vs activity vs settlements)
- If NotificationBell should stop polling entirely vs poll less frequently vs poll only when tab is visible

**Never:**
- No structural refactors beyond the 4 items
- No new features or UI changes beyond what's needed
- No rewriting the test runner once chosen
- No `console.log` in production code

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Report unauthenticated | No wallet header | 401 response, no data leaked | `verifyAuth` throws, caught by API handler |
| Report non-member | Wallet not in group members | 403 response | `assertGroupMembership` rejects |
| Pagination — empty page | No docs after cursor | Empty result array, no error | N/A |
| Pagination — last page | Fewer docs than limit | Partial result, `hasMore: false` | N/A |
| formatTime dedup | Existing callers use old inline funcs | Both callers import from shared lib, same behavior | N/A |
| Missing typecheck | `npm run typecheck` | `tsc --noEmit` exits 0 | Compilation errors surfaced |

</frozen-after-approval>

## Code Map

- `app/report/[groupId]/page.tsx` — client-side report with raw Firestore reads (no auth)
- `app/api/report/[groupId]/route.ts` — to be created: server API route with auth
- `app/api/groups/[id]/route.ts` — reference pattern for auth + admin SDK
- `lib/server/api-utils.ts` — `verifyAuth`, `assertGroupMembership` utilities (reuse)
- `lib/client/db.ts` — `getExpenses()`, `getSettlementPayments()`, `getGroupActivity()` (add pagination)
- `app/group/[id]/page.tsx` — real-time listeners (add limit to queries)
- `app/report/[groupId]/page.tsx` — report queries (add limit)
- `lib/client/notifications.ts` — `getNotifications()` (fix fake pagination)
- `lib/client/format.ts` — to be created: shared `formatTime`
- `app/page.tsx` — inline `formatTime` (replace with import)
- `components/layout/NotificationBell.tsx` — inline `formatTime` (replace with import), polling config
- `app/create-profile/page.tsx` — `catch (e)` (keep, correct pattern)
- `package.json` — add `typecheck` and `lint` scripts

## Tasks & Acceptance

**Execution:**
- [x] `app/report/[groupId]/page.tsx` + `app/api/report/[groupId]/route.ts` — Convert report to server API with `verifyAuth` + `assertGroupMembership`
- [x] `lib/client/db.ts` — Add `limit(n)` and cursor-based `startAfter` to `getExpenses`, `getSettlementPayments`, `getGroupActivity`
- [x] `app/group/[id]/page.tsx` — Add `limit(n)` to `onSnapshot` listeners
- [x] `lib/client/notifications.ts` — Fix `getNotifications` to use Firestore `limit()` instead of client-side slice
- [x] Root — Scaffold vitest + one smoke test
- [x] `lib/client/format.ts` — Create shared `formatTime`, export named function
- [x] `app/page.tsx` — Replace inline `formatTime` with shared import
- [x] `components/layout/NotificationBell.tsx` — Replace inline `formatTime` with shared import
- [x] `package.json` — Add `"typecheck": "tsc --noEmit"` and `"lint": "next lint"` scripts
- [x] `components/layout/NotificationBell.tsx` — Configurable polling interval

**Acceptance Criteria:**
- Given an unauthenticated request to the report page, when the page loads, then no group data is returned (401)
- Given any Firestore query for expenses/activity/settlements, when results exceed page size, then results are paginated with cursor
- Given `npm test`, when run, then vitest smoke test passes
- Given both consumers of formatTime, when they render timestamps, then behavior matches original inline versions
- Given `npm run typecheck`, when run, then exits 0
- Given `npm run lint`, when run, then exits 0
- Given `catch (e)` in create-profile, when an error occurs, then it correctly checks `e instanceof Error`

## Verification

**Commands:**
- `npm run build` — expected: exit 0
- `npm run typecheck` — expected: exit 0
- `npm run lint` — expected: exit 0
- `npm test` — expected: vitest smoke passes
