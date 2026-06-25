# Architecture Review — StableSplit

Generated: 2026-06-25

---

## Executive Summary

StableSplit's architecture has grown organically. The codebase shows signs of:
- **No defined layer boundaries** — business logic, data access, HTTP handling, and UI rendering are interleaved
- **Inconsistent client-server split** — reads bypass API auth, writes go through API routes, and notifications/recurrence mutate Firestore directly from the client
- **Monolithic page files** — the group detail page (`1982 lines`) handles 15+ distinct concerns
- **Repeated patterns** — 43 duplication clusters discovered in the parallel DUPLICATION_REPORT.md
- **Missing service layer** — API route handlers mix Firestore access, validation, business logic, and side effects in single functions

The architecture works today because Firebase Security Rules provide a safety net, but it will not scale in complexity, testing, or team size.

---

## 1. Current Architecture

### 1.1 Layer Diagram (As-Is)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Page Components (app/)                                       │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │  group/[id]/page.tsx  (1982 lines — all concerns)       │  │   │
│  │  │  page.tsx             (639 lines — data + UI mixed)     │  │   │
│  │  │  report/[groupId]/page.tsx (444 lines)                   │  │   │
│  │  │  3 other pages        (100-400 lines each)               │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                        ↕ imports                               │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  Feature Components (components/)                        │  │   │
│  │  │  WalletProvider, Navbar, AddExpenseModal, SettleAllModal │  │   │
│  │  │  GroupSettingsModal, ExportModal, NotificationBell ...   │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                        ↕ imports                               │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │  Client Library (lib/)                                   │  │   │
│  │  │  db.ts        (read/write wrappers, data mappers)        │  │   │
│  │  │  members.ts   (member manipulations)                     │  │   │
│  │  │  calculations.ts (balance math)                          │  │   │
│  │  │  profile.ts   (profile CRUD)                             │  │   │
│  │  │  notifications.ts (read + direct Firestore writes)       │  │   │
│  │  │  recurrence.ts (read + direct Firestore writes)          │  │   │
│  │  │  arc-payments.ts (blockchain interactions)               │  │   │
│  │  │  api-client.ts (UNUSED fetch wrapper)                    │  │   │
│  │  │  rates.ts, export.ts, templates.ts, image-upload.ts      │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │             ↕            ↕                                      │   │
│  │   Direct Firestore   HTTP (apiRequest)                          │   │
│  │   (client SDK)       ↓                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                          │                              │               │
│                          ▼                              ▼               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      SERVER (Next.js)                            │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │  API Routes (app/api/*/route.ts)                            │  │   │
│  │  │  Each handler does: verifyAuth → parseBody → Zod.validate  │  │   │
│  │  │  → checkMembership → adminDb.read → businessLogic          │  │   │
│  │  │  → adminDb.write → activityLog → respond                   │  │   │
│  │  │  (4-7 concerns per handler, NO service layer)              │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                        ↕                                          │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │  Shared Server Utilities (lib/)                             │  │   │
│  │  │  api-utils.ts   (verifyAuth, errorResponse, handleError)    │  │   │
│  │  │  firebase-admin.ts  (adminDb, serverTimestamp)              │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                        ↕                                          │   │
│  │                    ┌──────────────┐                               │   │
│  │                    │  Firestore   │                               │   │
│  │                    │  (Admin SDK) │                               │   │
│  │                    └──────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ⚠  NOTIFICATIONS + RECURRENCE: Client → Direct Firestore (no API)    │
│  ⚠  ALL READS: Client → Direct Firestore (no API, no auth)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow (As-Is)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ WRITE PATH                                          READ PATH              │
│                                                     │                      │
│ Client Component                Client Component    │                      │
│   ↓                                ↓                │                      │
│ lib/db.ts / lib/profile.ts     lib/db.ts (get*)   │                      │
│   ↓ (apiRequest)                  ↓ (client SDK)   │                      │
│ HTTP POST/PATCH/DELETE          firebase/firestore  │                      │
│   ↓                                ↓                │                      │
│ Next.js API Route ──→ adminDb    Firebase Client SDK│                     │
│   ↓                        → Firestore              │                     │
│ adminDb writes               ⚠ NO AUTH CHECK       │                     │
│ (auth verified)               ⚠ NO NORMALIZATION    │                    │
│                                                     │                      │
│ LATERAL WRITES (no API, no auth):                   │                      │
│   lib/recurrence.ts → direct Firestore writes       │                   │
│   lib/notifications.ts → direct Firestore writes    │                   │
│   lib/db.ts (uploadGroupImage) → direct write       │                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Provider Chain

```
ThemeProvider
  └─ WalletProvider (coupled to ThemeProvider via AppKitThemeSync)
       └─ Navbar (coupled to useProfileCheck)
       └─ main
            └─ ProfileGuard (coupled to useAccount from wagmi)
                 └─ ToastProvider
                      └─ {children}
```

---

## 2. Architectural Problems

### 2.1 No Layer Boundaries (CRITICAL)

**Problem:** API route handlers mix 4-7 concerns in single functions.

| Concern | Location | Present In |
|---------|----------|-----------|
| HTTP parsing | `request.json()` | Every handler |
| Input validation | Zod schemas | Every handler |
| Auth | `verifyAuth()` + inline membership checks | Every handler |
| Business logic | Inline Firestore queries + transformations | Every handler |
| Data access | Direct `adminDb.collection().doc().get()` | Every handler |
| Side effects | Inline activity record creation | Most handlers |
| Response formatting | `okResponse` / `errorResponse` | Every handler |

**Evidence:** Every single API route file in `app/api/` follows this exact pattern. There is zero service-layer abstraction between HTTP and Firestore.

**Impact:** Impossible to unit test business logic without Firestore emulator. Swapping databases requires changing every handler.

---

### 2.2 Inconsistent Client-Server Boundary (CRITICAL)

**Problem:** There is no coherent rule for what goes through API routes vs. direct Firestore.

```
Writes with auth:    Group CRUD, Expense CRUD, Settlement CRUD, Profile CRUD
Writes without auth: Notifications, Recurrence mutations, Image uploads
Reads without auth:  ALL reads (groups, expenses, settlements, profiles, activity)

Exception: GET /api/groups and GET /api/groups/[id] have API routes,
           but client code calls db.ts getGroup() directly instead.
```

**Evidence:**

| File | Line | What it does | Auth? |
|------|------|-------------|-------|
| `lib/db.ts` | 328 | `getAllGroups()` — fetches entire collection | **NO** |
| `lib/notifications.ts` | 82 | Writes notification documents | **NO** |
| `lib/recurrence.ts` | 70 | Creates expense documents (`addDoc`) | **NO** |
| `lib/recurrence.ts` | 72,103,109,115 | Updates recurrence fields | **NO** |

**Impact:** A malicious client could read every group in the database via `getAllGroups()`. Recurrence expense creation bypasses all server-side validation.

---

### 2.3 Monolithic Page Files (CRITICAL)

| File | Lines | Concerns Mixed |
|------|-------|----------------|
| `app/group/[id]/page.tsx` | 1982 | 15+ (Firestore listeners, state, 7 calculations, 4 tabs, 6 inline sub-components, 11 utility functions) |
| `app/page.tsx` | 639 | 5+ (data fetch, membership check, balance calc, activity agg, rendering) |
| `app/report/[groupId]/page.tsx` | 444 | 3+ (Firestore reads, calculations, rendering) |

**Evidence:** `app/group/[id]/page.tsx` defines 6 substantial inline components (`WalletBadge`, `ExpenseDetailsModal`, `ActivityPanel`, `BatchHistoryRenderer`, `InviteSection`, `DetailRow`) totaling ~395 lines plus 11 utility functions totaling ~96 lines. The page directly uses `onSnapshot`, `doc`, `collection` from the Firestore client SDK with no hook abstraction.

**Impact:** Impossible to reason about, test, or reuse. Every edit risks breaking unrelated functionality.

---

### 2.4 Missing Service Layer (HIGH)

**Problem:** API routes have no abstraction between HTTP handlers and Firestore.

**Evidence:**
- `app/api/groups/[id]/route.ts:79-259` handles 3 operations (`addMember`, `updateWallet`, general update) in a 180-line PATCH handler with Firestore directly.
- `app/api/settlements/route.ts:21-129` does Firestore reads, business logic, payment dedup, batch writes, and activity logging in one function.
- `lib/db.ts:38-100` (`generateNextOccurrence`) reads Firestore, creates documents, updates documents, logs activity, and sends notifications — all client-side, all interleaved.

**Impact:** Business logic cannot be tested independently. Adding a new write operation requires duplicating the same auth/validation/Firestore patterns.

---

### 2.5 Dual Data Mapping (HIGH)

**Problem:** Group data is mapped differently depending on the read path.

| Path | Function | Normalizes Members? |
|------|----------|-------------------|
| Client SDK read | `lib/db.ts:mapGroup()` (line 49) | YES — calls `normalizeMembers()` + `memberWalletMap()` |
| API route read | Inline in `app/api/groups/[id]/route.ts:59-73` | NO — returns raw `members` array |
| API route list | Inline in `app/api/groups/route.ts:148-164` | NO — returns raw `members` array |

**Impact:** Components get differently-shaped data depending on whether they call `getGroup()` or `GET /api/groups/[id]`. The server returns unnormalized members; client-side reads return normalized members.

---

### 2.6 Side Effects Interleaved with Data Access (HIGH)

**Problem:** Activity record creation is inline with every mutation instead of being separated.

**Evidence:**
- Activity records are created inline in **8 locations** across `app/api/` route handlers
- `lib/recurrence.ts:generateNextOccurrence()` does 5 sequential operations (read → create → update → activity log → notify) with no transactional guarantee
- Activity creation in the client (`lib/db.ts:addActivityRecord()`) goes through `POST /api/activity`, but server-side activity creation writes directly to Firestore — two different code paths doing the same thing

**Impact:** If activity logging fails, the main operation still proceeds (data inconsistency). No transactional rollback.

---

### 2.7 Provider Coupling (MEDIUM)

**Problem:** Providers depend on each other's internals.

| File | Lines | Issue |
|------|-------|-------|
| `components/WalletProvider.tsx` | 60-76 | `AppKitThemeSync` calls `useTheme()` — WalletProvider cannot exist without ThemeProvider |
| `components/Navbar.tsx` | 8,14 | Directly imports `useProfileCheck` — a shell layout coupled to a data hook |
| `components/ProfileGuard.tsx` | 5,18 | Directly imports `useAccount` from wagmi — couples auth guard to wallet library |

---

### 2.8 Redundant Layers (MEDIUM)

| File | Lines | Issue |
|------|-------|-------|
| `lib/api-client.ts` | 30 | **Unused** — zero imports from any file |
| `components/ui/Button.tsx` | 45 | **Unused** — zero imports, zero JSX usage |
| `components/ui/index.ts` | 4 | **Unused** barrel file — never imported |
| `app/api/activity/route.ts` | 49 | Exists but API routes don't call it — they write activity inline instead |

---

### 2.9 Scattered Business Logic (HIGH)

**Problem:** No single "domain" per concept. Each concept's logic is split across client `lib/`, server API routes, and inline in pages.

| Domain | Client Lib | Server Handler | Inline in Page |
|--------|-----------|---------------|----------------|
| Group | `db.ts` (wrap reads + writes) | `app/api/groups/route.ts`, `/[id]/route.ts` | `app/group/[id]/page.tsx` (delete, settings) |
| Expense | `db.ts` (reads + write wrappers) | `app/api/expenses/route.ts`, `/[id]/route.ts` | `app/group/[id]/page.tsx` (recurrence handlers) |
| Settlement | `db.ts` (reads + write wrapper) | `app/api/settlements/route.ts` | `app/group/[id]/page.tsx` (payment UI), `SettleAllModal.tsx` |
| Activity | `db.ts` (read + write wrapper) | `app/api/activity/route.ts` | Inline in every mutation route handler |
| Notification | `notifications.ts` (read + write) | **None** (client direct only) | `NotificationBell.tsx` |
| Recurrence | `recurrence.ts` (read + write) | **None** (client direct only) | `app/group/[id]/page.tsx` (trigger) |

---

## 3. Proposed Architecture

### 3.1 Layer Diagram (To-Be)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                                │
│                                                                          │
│  ┌─────────────────────────────┐  ┌────────────────────────────────┐    │
│  │  Pages (app/)                │  │  Shared Components (components/) │   │
│  │  Thin — props drilling only  │  │  No data access imports         │   │
│  │  No Firestore imports        │  │  Receive data via props/context │   │
│  │  No inline business logic    │  │  Pure UI components             │   │
│  └─────────────────────────────┘  └────────────────────────────────┘    │
│                   ↕                              ↕                       │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Custom Hooks (lib/hooks/)                                       │    │
│  │  useGroup, useExpenses, useSettlementPayments, useActivity        │    │
│  │  useDashboard, useReport, useRecurrence                          │    │
│  │  Encapsulate Firestore reads + API calls behind clean interfaces │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                   ↕                               ↕                      │
│  ┌────────────────────────────────────┐  ┌─────────────────────────┐     │
│  │  API Client Layer (lib/api/)       │  │  Data Mappers (lib/map/) │    │
│  │  api-client.ts (fetch wrapper)     │  │  mapGroup, mapExpense    │    │
│  │  groups.api.ts, expenses.api.ts    │  │  mapSettlementPayment    │    │
│  │  ... per-domain API modules        │  │  mapActivityRecord       │    │
│  └────────────────────────────────────┘  └─────────────────────────┘     │
│                   ↕                                                      │
│             HTTP (fetch)                                                  │
└──────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          SERVER (Next.js)                                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  API Routes (app/api/*/route.ts)                                 │    │
│  │  THIN handlers: parse request → call service → format response   │    │
│  │  No Firestore, no business logic, no inline side effects         │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                   ↕                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Service Layer (lib/server/)                                     │    │
│  │  groups.service.ts, expenses.service.ts, settlements.service.ts  │    │
│  │  profiles.service.ts, activity.service.ts, notifications.svc.ts  │    │
│  │  Contains: business logic, side effect orchestration              │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                   ↕                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Data Access Layer (lib/server/)                                 │    │
│  │  groups.repo.ts, expenses.repo.ts, settlements.repo.ts           │    │
│  │  Firestore queries & mutations ONLY — no business logic          │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                   ↕                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Infrastructure (lib/server/)                                     │    │
│  │  firebase-admin.ts, auth.ts, errors.ts, validation.ts            │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                   ↕                                                      │
│             ┌──────────────┐                                             │
│             │  Firestore   │                                             │
│             │ (Admin SDK)  │                                             │
│             └──────────────┘                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Proposed Data Flow

```
WRITE PATH                                     READ PATH
│                                               │
Page/Component                                  Page/Component
  ↓                                               ↓
Custom Hook (e.g., useExpense)                   Custom Hook (e.g., useExpenses)
  ↓                                               ↓
api-client → HTTP POST /api/expenses             api-client → HTTP GET /api/expenses?groupId=X
  ↓                                               ↓
API Route (thin handler)                          API Route (thin handler)
  ↓                                               ↓
expenses.service.ts (business logic)              expenses.service.ts (if needed)
  ↓                                               ↓
expenses.repo.ts (Firestore write)                expenses.repo.ts (Firestore query)
  ↓                                               ↓
Activity + Notifications (event-based)            Response with mapped data
  ↓                                               ↓
Return result                                     UI renders from hook state

ALL READS THROUGH API: No direct Firestore from client
ALL WRITES THROUGH API: No exceptions
ALL SIDE EFFECTS: Orchestrated at service layer, not in handlers
```

### 3.3 Proposed Directory Structure

```
lib/
├── api/                       # Client-side API communication
│   ├── api-client.ts          # Fetch wrapper (move from lib/, wire up)
│   ├── groups.api.ts          # Group API calls
│   ├── expenses.api.ts        # Expense API calls
│   ├── settlements.api.ts     # Settlement API calls
│   ├── profiles.api.ts        # Profile API calls
│   └── activity.api.ts        # Activity API calls
│
├── hooks/                     # Custom React hooks
│   ├── use-group.ts           # Group data + real-time updates
│   ├── use-expenses.ts        # Expense data
│   ├── use-settlements.ts     # Settlement data
│   ├── use-activity.ts        # Activity data
│   ├── use-dashboard.ts       # Dashboard data aggregation
│   ├── use-report.ts          # Report data
│   └── use-recurrence.ts      # Recurrence operations
│
├── map/                       # Data mappers (single source of truth)
│   ├── map-group.ts
│   ├── map-expense.ts
│   ├── map-settlement.ts
│   ├── map-activity.ts
│   ├── map-profile.ts
│   └── index.ts
│
├── server/                    # Server-only code
│   ├── firebase-admin.ts      # Admin SDK init (existing)
│   ├── auth.ts                # verifyAuth, assertMembership, assertOwner
│   ├── errors.ts              # errorResponse, okResponse, handleZodError, handleServerError
│   ├── validation.ts          # Shared Zod schemas
│   │
│   ├── groups.service.ts      # Group business logic
│   ├── groups.repo.ts         # Group Firestore access
│   ├── expenses.service.ts    # Expense business logic
│   ├── expenses.repo.ts       # Expense Firestore access
│   ├── settlements.service.ts # Settlement business logic
│   ├── settlements.repo.ts    # Settlement Firestore access
│   ├── profiles.service.ts    # Profile business logic
│   ├── profiles.repo.ts       # Profile Firestore access
│   └── activity.service.ts    # Activity logging + notification dispatch
│
├── calculations.ts            # Balance math (keep as-is, well factored)
├── members.ts                 # Member utilities (keep as-is)
├── arc-payments.ts            # Blockchain interactions (keep as-is)
│
├── wallet.ts                  # Wallet utilities (keep as-is)
├── rates.ts                   # FX rates (keep as-is)
├── export.ts                  # CSV/PDF export (keep as-is)
├── image-upload.ts            # Image helpers (keep as-is)
├── recurrence.ts              # Recurrence logic (keep — but move writes to API)
├── notifications.ts           # Notification logic (keep — but move writes to API)
├── templates.ts               # Group templates (keep as-is)
│
├── utils/                     # Shared utilities
│   ├── timestamp.ts           # toMillis (single canonical version)
│   ├── format.ts              # Amount formatting, address shortening
│   ├── date-utils.ts          # Date formatting helpers
│   └── activity-helpers.ts    # Activity icon/color/label helpers
│
└── types.ts                   # Canonical types (keep as-is)

components/
├── ui/                        # Shared UI primitives
│   ├── Modal.tsx              # (keep, wire all modals to use it)
│   ├── Toast.tsx              # (keep)
│   ├── Skeleton.tsx           # (keep)
│   ├── AlertBanner.tsx        # NEW — shared error/info banner
│   ├── BackLink.tsx           # NEW — shared back navigation
│   ├── FilterChip.tsx         # NEW — shared filter toggle
│   ├── SegmentedControl.tsx   # NEW — shared segment buttons
│   ├── FillWalletButton.tsx   # NEW — "use connected wallet"
│   ├── WalletBadge.tsx        # NEW — wallet address display
│   └── DemoBadge.tsx          # NEW — demo indicator
│
├── modals/                    # NEW — extracted modal components
│   ├── AddExpenseModal.tsx    # (move from components/)
│   ├── ExpenseDetailsModal.tsx # NEW — extract from page.tsx
│   ├── SettleAllModal.tsx     # (keep in components/)
│   ├── GroupSettingsModal.tsx # (keep in components/)
│   ├── MemberWalletModal.tsx  # (keep in components/)
│   └── ExportModal.tsx        # (keep in components/)
│
├── wallet/                    # NEW — wallet UI components
│   ├── WalletConnectButton.tsx
│   ├── WalletProvider.tsx
│   └── FillWalletButton.tsx
│
├── layout/                    # NEW — layout components
│   ├── Navbar.tsx
│   ├── ProfileGuard.tsx
│   └── ThemeProvider.tsx
│
├── activity/                  # NEW — activity feed components
│   ├── ActivityPanel.tsx      # (extract from page.tsx)
│   └── ActivityIcon.tsx       # (uses lib/utils/activity-helpers)
│
└── ... (existing components, moved to subdirs as appropriate)
```

### 3.4 Proposed Provider Chain

```
ThemeProvider
  └─ (no change — truly global)
       └─ WalletProvider
            └─ (remove AppKitThemeSync — decouple from ThemeProvider)
                 └─ ProfileProvider  (NEW — provides profile context)
                      └─ Navbar (reads profile from context, not import)
                           └─ main
                                └─ ProfileGuard (reads from context, not wagmi directly)
                                     └─ ToastProvider
                                          └─ {children}
```

---

## 4. Migration Strategy

The strategy follows a **"strangler fig"** pattern — new structure grows alongside old, with incremental migration over multiple phases. **Do not attempt a monolithic rewrite.**

### Phase 1: Foundation (Week 1-2)

**Goal:** Establish the architectural foundations without changing any behavior.

| Step | Action | Files Affected |
|------|--------|----------------|
| 1.1 | Create `lib/server/` directory structure | New directory |
| 1.2 | Move `verifyAuth`, `assertMembership`, `assertOwner` into `lib/server/auth.ts` | `lib/api-utils.ts` → auth.ts |
| 1.3 | Extract `handleZodError`, `parseBody` into `lib/server/errors.ts` | `lib/api-utils.ts` → errors.ts |
| 1.4 | Extract shared Zod schemas into `lib/server/validation.ts` | All route files |
| 1.5 | Create `lib/utils/timestamp.ts` with single `toMillis` | Remove 4 copies |
| 1.6 | Create `lib/utils/format.ts` with `formatAmount`, `shortenAddress` | Replace 55+ inline `toFixed(2)` |
| 1.7 | Create `lib/utils/date-utils.ts` | Extract from group page + report page |
| 1.8 | Create `lib/utils/activity-helpers.ts` | Extract 7 × 2 duplicate functions |

**Risk:** LOW — pure extraction, no behavioral change.

### Phase 2: Server Service Layer (Week 3-4)

**Goal:** Extract business logic from API route handlers into service modules.

| Step | Action | Files Affected |
|------|--------|----------------|
| 2.1 | Create `lib/server/groups.service.ts` + `groups.repo.ts` | Move write logic from `app/api/groups/route.ts` and `/[id]/route.ts` |
| 2.2 | Create `lib/server/expenses.service.ts` + `expenses.repo.ts` | Move write logic from `app/api/expenses/route.ts` |
| 2.3 | Create `lib/server/settlements.service.ts` + `settlements.repo.ts` | Move write logic from `app/api/settlements/route.ts` |
| 2.4 | Create `lib/server/profiles.service.ts` + `profiles.repo.ts` | Move write logic from `app/api/profiles/route.ts` |
| 2.5 | Create `lib/server/activity.service.ts` | Consolidate activity logging from 8 locations |
| 2.6 | Thin each API route handler to: parse → call service → respond | All route files |

**Risk:** MEDIUM — requires careful extraction to avoid breaking request/response contracts.

### Phase 3: Client API Layer (Week 4-5)

**Goal:** Route all reads through API routes and create client-side API modules.

| Step | Action | Files Affected |
|------|--------|----------------|
| 3.1 | Wire up `lib/api/api-client.ts` (move from `lib/api-client.ts`) | Existing dead file |
| 3.2 | Create `lib/api/groups.api.ts` | GET/POST/PATCH/DELETE calls |
| 3.3 | Create `lib/api/expenses.api.ts` | GET/POST/DELETE calls |
| 3.4 | Create `lib/api/settlements.api.ts` | GET/POST calls |
| 3.5 | Create `lib/api/profiles.api.ts` | GET/POST/PATCH calls |
| 3.6 | Create `lib/api/activity.api.ts` | POST calls |
| 3.7 | Add GET endpoints to existing routes (where missing for reads) | Various route files |
| 3.8 | Create `lib/map/` with canonical data mappers | `lib/db.ts` extract |

**Risk:** HIGH — this is the most impactful change. All reads currently go directly to Firestore. Route them through API:

- **Performance impact:** Each read adds an HTTP round trip
- **Auth enforcement gain:** Every read is authenticated
- **Strategy:** Add API routes first, then switch client code incrementally

### Phase 4: Custom Hooks (Week 5-6)

**Goal:** Encapsulate data access behind React hooks, removing Firestore imports from pages.

| Step | Action | Files Affected |
|------|--------|----------------|
| 4.1 | Create `lib/hooks/use-group.ts` | Replace Firestore listeners in `app/group/[id]/page.tsx` |
| 4.2 | Create `lib/hooks/use-expenses.ts` | Replace Firestore listeners |
| 4.3 | Create `lib/hooks/use-settlements.ts` | Replace Firestore listeners |
| 4.4 | Create `lib/hooks/use-activity.ts` | Replace Firestore listeners |
| 4.5 | Create `lib/hooks/use-dashboard.ts` | Extract 140-line data fetch from `app/page.tsx` |
| 4.6 | Create `lib/hooks/use-report.ts` | Extract from `app/report/[groupId]/page.tsx` |
| 4.7 | Create `lib/hooks/use-recurrence.ts` | Move recurrence operations behind hook (→ reaches API route) |

**Risk:** MEDIUM — hooks are additive. Pages keep working during migration.

### Phase 5: Decompose Monolithic Pages (Week 6-8)

**Goal:** Break `app/group/[id]/page.tsx` into manageable pieces.

| Step | Action | Files Affected |
|------|--------|----------------|
| 5.1 | Extract `ExpenseDetailsModal` → `components/modals/ExpenseDetailsModal.tsx` | ~74 lines |
| 5.2 | Extract `ActivityPanel` → `components/activity/ActivityPanel.tsx` | ~128 lines |
| 5.3 | Extract `BatchHistoryRenderer` → `components/BatchHistoryRenderer.tsx` | ~103 lines |
| 5.4 | Extract `WalletBadge` → `components/ui/WalletBadge.tsx` | ~28 lines shared |
| 5.5 | Delete `InviteSection` (dead code, never rendered) | ~62 lines removed |
| 5.6 | Extract balance display → `components/BalanceList.tsx` shared | ~80 lines |
| 5.7 | Extract settlement list → `components/SettlementList.tsx` shared | ~128 lines |
| 5.8 | Replace inline modal backdrops with `components/ui/Modal.tsx` | 7 modal sites |

**Risk:** MEDIUM — each extraction is straightforward but must preserve all state and event handlers.

### Phase 6: Consolidate Duplicate Modules (Week 7-8)

**Goal:** Resolve all duplication findings from DUPLICATION_REPORT.md.

| Step | Action |
|------|--------|
| 6.1 | Use `memberWalletMap()` in all 6 API route locations |
| 6.2 | Use `createMember()` / `normalizeMembers()` in all API routes |
| 6.3 | Remove `shortAddress()` from `wallet.ts` — use `shortenAddress()` from `members.ts` |
| 6.4 | Consolidate `validateEvmAddress()` to `lib/wallet.ts` |
| 6.5 | Remove unused `api-client.ts`, `Button.tsx`, `ui/index.ts`, `wallet-empty-accounts.ts` |
| 6.6 | Merge `GroupImageUpload` + `ProfileAvatarUpload` into parameterized component |
| 6.7 | Extract shared `executeOnChainSettlement()` to `lib/arc-payments.ts` |

**Risk:** LOW — each is a mechanical refactor.

### Phase 7: Side Effect Separation (Week 8-9)

**Goal:** Decouple side effects (activity logging, notifications) from data mutations.

| Step | Action | Files Affected |
|------|--------|----------------|
| 7.1 | Move recurrence writes behind API route (currently client-side `addDoc`) | `lib/recurrence.ts` → new API route |
| 7.2 | Move notification writes behind API route (currently client-side) | `lib/notifications.ts` → new API route |
| 7.3 | Move image upload behind API route (currently client-side) | `lib/db.ts` upload → new API route |
| 7.4 | Extract activity creation in `app/api/routes` → call `activity.service.ts` | All route files |
| 7.5 | Create `lib/server/activity.service.ts` — event-based dispatch | New |

**Risk:** HIGH — moving client-side writes to server-side changes the auth model. Notifications currently work without auth; after this change, they require wallet auth.

### Phase 8: Decouple Provider Chain (Week 9)

| Step | Action |
|------|--------|
| 8.1 | Remove `AppKitThemeSync` from `WalletProvider` — pass theme as prop instead |
| 8.2 | Create `ProfileProvider` context — Navbar reads profile from context, not hook |
| 8.3 | ProfileGuard reads `isConnected` from a generic adapter, not wagmi directly |

**Risk:** LOW — should not affect functionality.

---

## 5. Risk Assessment

### 5.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 3 (routing reads through API) adds latency | HIGH | MEDIUM | Add optimistic caching in hooks. Firestore normally has network latency anyway. |
| Phase 3 breaks real-time updates (onSnapshot) | HIGH | HIGH | Implement WebSocket/SSE or polling in hooks. Or keep real-time on a per-feature basis via a separate read path. |
| Phase 7 (moving client writes to API) breaks recurrence for disconnected users | MEDIUM | MEDIUM | Recurrence is server-scheduled anyway — move to a Cloud Function. |
| Phase 7 breaks notifications for users without wallet | MEDIUM | LOW | Add a server-side notification API that accepts a profile ID. |
| Phase 2 (service extraction) introduces bugs | MEDIUM | HIGH | Write integration tests for each service BEFORE extraction. |
| Phase 5 (page decomposition) breaks complex state | MEDIUM | HIGH | Extract one component at a time. Verify group page functionality after each. |
| Developer productivity drops during migration | HIGH | HIGH | Parallel work on old + new paths during Phases 2-4. Never block shipping. |
| Migration stalls (too many phases) | MEDIUM | MEDIUM | Prioritize Phase 1 + 2 + 5 as the minimum viable improvement. |

### 5.2 Minimum Viable Architecture Improvement

If the full migration is too ambitious, the **highest-value / lowest-risk** steps are:

1. **Phase 1.2-1.5** (shared utilities — `auth.ts`, `errors.ts`, `validation.ts`, `timestamp.ts`)
2. **Phase 2.1** (groups service — the most complex route handler)
3. **Phase 5.1-5.3** (extract the 3 largest inline components from the group page)
4. **Phase 6.4** (consolidate address validation — security concern)
5. **Phase 5.6-5.7** (extract shared balance + settlement components)

### 5.3 Keep As-Is

These modules are well-factored and should remain untouched:

| File | Reason |
|------|--------|
| `lib/calculations.ts` | Pure functions, single responsibility, tested via consumers |
| `lib/members.ts` | Well-organized utility module |
| `lib/arc-payments.ts` | Clear single responsibility (blockchain) |
| `lib/wallet.ts` | Clean chain config + wallet utilities |
| `lib/rates.ts` | Simple fetch + cache |
| `lib/export.ts` | Self-contained utility |
| `lib/templates.ts` | Static data |
| `components/ui/Toast.tsx` | Well-designed, properly consumed |
| `components/ui/Modal.tsx` | Well-designed — just needs to be used by more consumers |

### 5.4 Anti-Patterns to Avoid During Migration

| Anti-Pattern | Why |
|-------------|-----|
| Creating an `index.ts` barrel file in every directory | Obscures imports, causes churn |
| Premature interface extraction (Repo interfaces with single implementation) | Adds abstraction without value |
| Creating a `utils/` dumping ground | Becomes a trash can. Each utility file should have a clear purpose. |
| Rewriting everything in one branch | Merge conflicts + untestable. Do one phase at a time. |
| Adding a DI container or IoC framework | Overkill for this application size. Simple imports suffice. |
| Over-abstracting the UI layer | Not every component needs an interface, a story, and a test file. |

---

## 6. Architecture Scorecard

| Criteria | Current | Target |
|----------|---------|--------|
| Layer separation | None — all concerns mixed | 5 layers (page → hook → API → service → repo) |
| Testability | Low (business logic tied to Firestore) | High (services testable without Firestore) |
| Auth consistency | Writes: partial, Reads: none | All operations authenticated |
| Data mapping consistency | 3 versions of group mapping | 1 canonical mapper per entity |
| Page size (max) | 1982 lines | <400 lines |
| Duplicate code | 43 clusters | 0 clusters |
| Server-side service layer | None | Per-domain service + repo |
| Client-side data abstraction | Direct Firestore imports in pages | Custom hooks |
| Provider coupling | 3 instances | 0 instances |
| Unused code | 5 files + 1 component | 0 files |
