# Library Modules (`lib/`)

## `lib/types.ts`

All TypeScript types and interfaces used across the app.

**Key types:**
- `Group` — group document (id, name, description, currency, members, inviteCode, imageUrl, createdAt, createdBy)
- `Expense` — expense document (id, groupId, title, amount, currency, paidBy, splits, category, date, recurrenceConfig, createdAt)
- `Member` — group member info (uid, displayName, email, phone, walletAddress)
- `UserProfile` — user profile (name, walletAddress, avatarUrl, groupIds, createdAt)
- `Balance` / `Settlement` — computed balances and recommended transfers
- `SettlementPayment` — on-chain payment record (from, to, amount, tokenAddress, txHash, status)
- `AppNotification` — in-app notification (type, message, groupId, read, timestamp)
- `ActivityRecord` — group activity feed entry
- `RecurrenceConfig` — recurring expense config (frequency, interval, nextDate, endDate)
- `Split` — per-member split detail (uid, amount, percentage, shares)
- `ExchangeRate` — cached FX rate data
- `Category` — expense category enum

## `lib/firebase.ts`

Initializes Firebase app, Firestore (`db`), and Storage (`storage`) instances from environment variables. Single source of truth for Firebase client SDK.

## `lib/db.ts`

All Firestore CRUD operations. Pure data access — no UI logic.

**Functions:**
- `createGroup`, `getGroup`, `updateGroup`, `deleteGroup`
- `addExpense`, `getExpenses`, `updateExpense`, `deleteExpense`
- `addActivityRecord`, `getActivityRecords`
- `createSettlementPayment`, `getSettlementPayments`, `updateSettlementPayment`
- `getGroupByInviteCode`
- `getMemberWallet` / `setMemberWallet`

## `lib/calculations.ts`

Expense balance computation and settlement optimization.

**Key functions:**
- `calculateBalances(expenses, members)` — Net balance per member
- `getOptimalSettlements(expenses, members)` — Minimum-transfer settlement plan
- `CATEGORY_COLORS` — Color map for expense categories
- `CATEGORIES` — List of expense categories with display labels
- `CURRENCIES` — Supported currencies (USD, EUR, GBP, etc.)

## `lib/members.ts`

Group member utilities.

**Functions:**
- `createMember(displayName, uid?)` — Create a Member object with avatar color
- `createMemberFromProfile(profile)` — Derive member from UserProfile
- `getMemberById(group, uid)` — Find member by ID
- `isValidEthereumAddress(address)` — Validate 0x-prefixed address
- `MEMBER_COLORS` — Deterministic avatar color palette
- `hashStringToColor(str)` — Consistent color from string

## `lib/profile.ts`

User profile operations on Firestore.

**Functions:**
- `getUserProfile(userId)` — Fetch profile by ID
- `upsertUserProfile(userId, data)` — Create or update profile
- `uploadAvatar(userId, file)` — Upload profile image to Firebase Storage
- `addGroupToUserProfile(userId, groupId)` — Track group membership on profile
- `removeGroupFromUserProfile(userId, groupId)` — Remove group from profile

## `lib/local-profile.ts`

Small utility deriving a profile ID from a wallet address by lowercasing the `0x` address. Used as the Firestore document ID for user profiles.

**Functions:**
- `getProfileIdFromWallet(walletAddress)` — Returns `walletAddress.toLowerCase()`

## `lib/recurrence.ts`

Recurring expense logic. Creates next occurrence based on frequency.

**Functions:**
- `getNextRecurrenceDate(currentDate, config)` — Compute next date from config
- `generateRecurringExpenses(expense, count?)` — Generate future expense instances
- `pauseRecurringExpense(expenseId)` — Temporarily stop recurrence
- `resumeRecurringExpense(expenseId)` — Resume paused recurrence
- `deleteRecurringExpense(expenseId)` — Remove all future occurrences

## `lib/rates.ts`

FX rate fetching with caching.

**Functions:**
- `getExchangeRate(from, to)` — Fetch rate from exchangerate-api.com, cached in localStorage for 1 hour
- `convertAmount(amount, from, to)` — Convert between currencies

## `lib/export.ts`

Data export — CSV and PDF generation.

**Functions:**
- `exportToCSV(data, filename)` — Generic CSV download
- `exportExpensesCSV(expenses, members)` — Expense CSV
- `exportSettlementsCSV(settlements, members)` — Settlement CSV
- `exportActivityCSV(activity, members)` — Activity CSV
- `generatePDFReport(groupId)` — Full PDF report using jsPDF + html2canvas

## `lib/templates.ts`

Group creation templates — predefined expense categories and member suggestions.

**Templates:**
- `roommates` — Rent, utilities, groceries, internet
- `trip` — Accommodation, transport, food, activities
- `friends` — Dining, entertainment, gifts
- `project` — Domain, hosting, tools, subscriptions
- `event` — Venue, catering, decoration, entertainment
- `custom` — Empty template

**Functions:**
- `getTemplate(templateId)` — Get template by ID
- `getAllTemplates()` — List all templates

## `lib/image-upload.ts`

Client-side image processing for profile and group avatars.

**Functions:**
- `compressImage(file, maxWidth?, maxHeight?, quality?)` — Resize and compress to JPEG
- `cropAndResize(file, size)` — Crop to square and resize to 400x400

## `lib/notifications.ts`

In-app notification CRUD on Firestore.

**Functions:**
- `createNotification(notification)` — Create notification document
- `getNotifications(userId)` — Fetch notifications for user
- `getUnreadCount(userId)` — Count unread notifications
- `markAsRead(notificationId)` — Mark single notification read
- `markAllAsRead(userId)` — Mark all notifications read

## `lib/arc-payments.ts`

ARC-20 token contract interactions on Arc Testnet.

**Exports:**
- `USDC_CONTRACT_ADDRESS` — USDC token address on Arc Testnet
- `EUR_CONTRACT_ADDRESS` — EUR token address on Arc Testnet
- `USDC_ABI` — Minimal ERC-20 ABI for USDC
- `EUR_ABI` — Minimal ERC-20 ABI for EUR
- `sendUSDCPayment(to, amount, signer)` — Transfer USDC
- `sendEURPayment(to, amount, signer)` — Transfer EUR

## `lib/wallet.ts`

Wallet initialization and chain configuration.

**Functions:**
- `createConfig()` — Wagmi config with Reown AppKit, Arc Testnet chain
- `switchToArcTestnet()` — Prompt wallet to switch to Arc Testnet
- Chain definition for Arc Testnet (chain ID 5042002, native currency ARC)

**Reown AppKit:** Uses `@reown-io/appkit` with Wagmi adapter — provides the connect/disconnect modal.

## `lib/wallet-empty-accounts.ts`

Empty module — resolves the `accounts` import alias configured in `next.config.ts`. No actual implementation.
