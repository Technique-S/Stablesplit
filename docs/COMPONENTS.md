# Components (`components/`)

## `Navbar.tsx`
Top navigation bar. Contains:
- Logo / app title
- Theme toggle (light/dark)
- Wallet connect button
- Notification bell with unread badge
- Profile link (avatar + name, or create-profile link)
- Active group ID detection from URL

## `WalletProvider.tsx`
Wraps the app with Reown AppKit + Wagmi provider. Handles:
- Wagmi configuration creation
- Reown AppKit initialization with project ID
- Ready-state synchronization (avoids flash of unstyled content)

## `ThemeProvider.tsx`
Light/dark theme context provider. Features:
- Reads initial theme from `localStorage('theme')` or system preference
- Toggles between `light` and `dark` classes on `<html>`
- Persists choice to localStorage
- Exports `useTheme()` hook

## `ProfileGuard.tsx`
Route guard component. Wraps children and redirects to `/create-profile` when:
- Wallet is connected
- No user profile exists for the connected wallet address
Skips check on `/create-profile` and `/join/[inviteCode]` pages.

## `OnboardingScreen.tsx`
Full-screen landing page shown when no wallet is connected. Displays:
- App name and tagline
- Feature highlights
- "Connect Wallet" / "Get Started" call-to-action
- Used as dashboard fallback (replaces group list when wallet not connected)

## `AddExpenseModal.tsx`
Modal dialog for creating/editing expenses. Fields:
- Title, amount, currency (with FX rate conversion display)
- Category selector (grid of colored category buttons)
- Date picker
- Paid by (member selector)
- Split type: equal / custom (per-member amount or percentage)
- Recurrence: one-time / weekly / monthly / quarterly / yearly

## `ExportModal.tsx`
Modal for exporting group data. Options:
- CSV: Expenses / Settlements / Activity (separate downloads)
- PDF: Full report with expenses, balances, settlements, activity log, ARC metrics
- Close button

## `AccordionSection.tsx`
Collapsible section wrapper. Props:
- `title` — Section header
- `defaultOpen` — Initial state
- Animated height transition on toggle
- Chevron icon rotation indicator

## `FloatingActionMenu.tsx`
Fixed-position FAB (bottom-right) with expandable action buttons. Actions:
- "Add Expense" — Opens AddExpenseModal
- "Settle" — Opens SettleAllModal
- "Export" — Opens ExportModal
- "Settings" — Opens GroupSettingsModal
Used only on group detail page.

## `SettlementPaymentButton.tsx`
Single settlement payment button. Given a settlement (from, to, amount):
- Detects currency and picks the correct token (USDC or EUR)
- Calls `sendUSDCPayment` or `sendEURPayment` via Wagmi/Viem
- Records result as `SettlementPayment` in Firestore
- Shows status feedback (pending, confirming, confirmed, failed)

## `SettleAllModal.tsx`
Batch settlement modal. For a group:
- Displays all recommended settlements from `getOptimalSettlements()`
- Executes each settlement sequentially via SettlementPaymentButton logic
- Shows progress bar and per-settlement status
- Handles partial failures (continues with remaining settlements)

## `ConfirmModal.tsx`
Generic confirmation dialog. Props:
- `title`, `message`, `confirmLabel`, `cancelLabel`
- `onConfirm`, `onCancel` callbacks
- Visual confirm/cancel buttons with accent color

## `MemberWalletModal.tsx`
Modal for editing a group member's EVM wallet address. Features:
- Input field for `0x`-prefixed address
- Validation via `isValidEthereumAddress()`
- Saves via `setMemberWallet()` in Firestore
- Close without saving

## `GroupSettingsModal.tsx`
Group settings editor. Sections:
- Group name, description
- Default currency
- Image upload (via GroupImageUpload)
- Member list with wallet addresses (click to edit via MemberWalletModal)
- Remove member (with balance check — prevents removal if member has non-zero balance)
- Delete group (with confirmation)

## `GroupImageUpload.tsx`
Group avatar upload component. Flow:
- File picker → compress via `compressImage()` → square crop 400x400
- Preview before upload
- Uploads to Firebase Storage, updates group's `imageUrl`

## `ProfileAvatarUpload.tsx`
User avatar upload component. Same pattern as GroupImageUpload but for user profiles.

## `TemplatePicker.tsx`
Grid of group creation templates. Each template shows:
- Icon and name
- Short description
- Preview of default categories
Calls `getAllTemplates()` from `lib/templates.ts`. Selecting a template pre-fills the create-group form.

## `NotificationBell.tsx`
Bell icon with unread count badge. On click:
- Opens dropdown notification list
- Each notification shows type, message, relative timestamp
- Clicking a notification marks it read and navigates (e.g., to group)
- "Mark all as read" button
- Empty state when no notifications

## `WalletConnectButton.tsx`
Wallet connection button with states:
- Disconnected: "Connect Wallet" → opens Reown AppKit modal
- Connected: Shows truncated address (0x1234...5678)
- Dropdown: Disconnect, Switch to Arc Testnet, Faucet link, Gas tracker link
- Responsive (icon-only on small screens)
