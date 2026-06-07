# App Pages (app/)

## Root Layout (app/layout.tsx)
Provider chain: ThemeProvider > WalletProvider > ProfileGuard. Global CSS imported from app/globals.css. Font: Geist (local, variable weight).

## Dashboard (app/page.tsx)
Route: `/`

States:
- **No wallet** — Renders OnboardingScreen (landing page with CTA)
- **Wallet, no profile** — Redirect to /create-profile (via ProfileGuard)
- **Wallet + profile** — Dashboard with: welcome header, group list cards (name, member count, balance summary), total balance, recent activity feed, demo mode toggle

Data: Reads `getUserProfile()` -> `groupIds`, loads each group via `getGroup()`.

## Create Group (app/create/page.tsx)
Route: `/create`

Form: Template picker (TemplatePicker), group name, description, currency, image upload, members (name + optional wallet), auto-generated invite code. Calls `createGroup()` and adds group ID to profile.

## Group Detail (app/group/[id]/page.tsx)
Route: `/group/[id]`

Four tabs:
1. **Expenses** — List with paid-by, amount, category badge, recurrence indicator. Edit/delete actions. Add Expense button.
2. **Balances** — Per-member net balance via `calculateBalances()`. Color-coded.
3. **Settle** — Recommended settlements via `getOptimalSettlements()`. SettlementPaymentButton per-item. Settle All opens SettleAllModal. Shows previous settlement payments.
4. **History** — Activity feed from `getActivityRecords()`.

FAB: Add Expense / Settle / Export / Settings. Modals: AddExpenseModal, SettleAllModal, ExportModal, GroupSettingsModal, ConfirmModal.

## Profile (app/profile/page.tsx)
Route: `/profile`

Edit display name, avatar (ProfileAvatarUpload), wallet address (read-only), linked groups list. Calls `upsertUserProfile()` on save.

## Join Group (app/join/[inviteCode]/page.tsx)
Route: `/join/[inviteCode]`

Flow: Lookup group by inviteCode -> show group preview -> if wallet connected, create member entry and add group to profile -> if wallet not connected, prompt connect then proceed. Shows success or error states.

## Create Profile (app/create-profile/page.tsx)
Route: `/create-profile`

First-time setup after wallet connect. Form: display name, avatar upload. Calls `upsertUserProfile()` to create profile document (ID = wallet address lowercased). After save, redirects to `/`.

## Report (app/report/[groupId]/page.tsx)
Route: `/report/[groupId]`

Static read-only report view. Shows: group info, member list, expenses breakdown by category, balance summary, settlement plan, activity log, ARC on-chain metrics (token balances, total settled). Print-friendly layout. No edit actions.
