# StableSplit

A modern expense-splitting web app with on-chain settlement via ARC-20 tokens on Arc Testnet. Built with Next.js 16, Tailwind CSS v4, Firebase Firestore, and Reown AppKit wallet integration.

## Features

- **Group expense tracking** — Create groups, add expenses with categories and custom splits
- **Auto balance calculation** — Per-member net balances with optimized settlement (minimum transactions)
- **On-chain settlements** — Pay debts with USDC or EUR tokens on Arc Testnet via ARC-20 contracts
- **Multi-currency** — Expenses in any currency with real-time FX rate conversion (exchangerate-api.com)
- **Recurring expenses** — Weekly/monthly/quarterly/yearly repeating expenses
- **Group templates** — Pre-built category sets (roommates, trip, friends, project, event)
- **Image uploads** — Group and profile avatars with client-side crop + compress (400x400 JPEG)
- **In-app notifications** — Activity alerts with read/unread tracking
- **Data export** — CSV (expenses, settlements, activity) and full PDF reports via jsPDF + html2canvas
- **Wallet-based auth** — No email/password; connect any EVM wallet via Reown AppKit
- **Light/dark theme** — Persisted to localStorage, synced with system preference

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack, App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Firebase Firestore |
| Auth | Reown AppKit (wallet-based) |
| Blockchain | Arc Testnet (chain ID 5042002) + Wagmi + Viem |
| Storage | Firebase Storage |
| Export | jsPDF, html2canvas, CSV |
| FX Rates | exchangerate-api.com (localStorage cache) |

## Setup

### 1. Install
```bash
npm install
```

### 2. Firebase
1. Create a Firebase project at console.firebase.google.com
2. Enable Firestore Database (test mode for dev)
3. Enable Storage (for image uploads)
4. Add a web app and copy the config values

### 3. Reown (Wallet)
1. Create a project at https://cloud.reown.com
2. Copy the Project ID

### 4. Environment Variables
Create `.env.local` and fill in all values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_REOWN_PROJECT_ID=
```

### 5. Firestore Indexes
The app may require composite indexes for sorted queries. Check Firebase Console > Firestore > Indexes for "index required" errors on first query and create them.

### 6. Run
```bash
npm run dev
```
Open http://localhost:3000

## Project Structure

```
stablesplit/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (providers)
│   ├── page.tsx                  # Dashboard
│   ├── create/                   # Group creation
│   ├── create-profile/           # First-time profile setup
│   ├── group/[id]/               # Group detail (4 tabs)
│   ├── join/[inviteCode]/        # Join by invite code
│   ├── profile/                  # User profile
│   └── report/[groupId]/         # Static report
├── components/                   # Reusable UI components
│   ├── Navbar.tsx                # Top navigation
│   ├── WalletProvider.tsx        # Reown + Wagmi provider
│   ├── ThemeProvider.tsx         # Light/dark theme
│   ├── ProfileGuard.tsx          # Route guard
│   ├── OnboardingScreen.tsx      # Landing page
│   ├── AddExpenseModal.tsx       # Expense form
│   ├── ExportModal.tsx           # CSV/PDF export
│   ├── AccordionSection.tsx      # Collapsible section
│   ├── FloatingActionMenu.tsx    # FAB with actions
│   ├── SettlementPaymentButton.tsx # Single settlement
│   ├── SettleAllModal.tsx        # Batch settlement
│   ├── ConfirmModal.tsx          # Confirmation dialog
│   ├── MemberWalletModal.tsx     # Wallet address editor
│   ├── GroupSettingsModal.tsx    # Group settings
│   ├── GroupImageUpload.tsx      # Group avatar upload
│   ├── ProfileAvatarUpload.tsx   # Profile avatar upload
│   ├── TemplatePicker.tsx        # Template selector
│   ├── NotificationBell.tsx      # Notifications dropdown
│   └── WalletConnectButton.tsx   # Connect/disconnect
├── lib/                          # Business logic & data access
│   ├── types.ts                  # All TypeScript types
│   ├── firebase.ts               # Firebase init
│   ├── db.ts                     # Firestore CRUD
│   ├── calculations.ts           # Balances + settlements
│   ├── members.ts                # Member utilities
│   ├── profile.ts                # User profile operations
│   ├── local-profile.ts          # Profile ID from wallet
│   ├── recurrence.ts             # Recurring expense logic
│   ├── rates.ts                  # FX rate fetching
│   ├── export.ts                 # CSV + PDF generation
│   ├── templates.ts              # Group templates
│   ├── image-upload.ts           # Image compress/crop
│   ├── notifications.ts          # Notification CRUD
│   ├── arc-payments.ts           # ARC-20 token payments
│   ├── wallet.ts                 # Wallet + chain config
│   └── wallet-empty-accounts.ts  # Empty alias stub
├── functions/                    # Firebase Cloud Functions (stub)
├── dataconnect/                  # Firebase Data Connect (unused boilerplate)
├── public/                       # Static assets
└── docs/                         # Documentation
```

## Documentation

See the `docs/` folder for detailed documentation:
- [Architecture](docs/ARCHITECTURE.md) — Tech stack, data flow, directory structure
- [Libraries](docs/LIB.md) — All lib/ modules documented
- [Components](docs/COMPONENTS.md) — All components documented
- [App Pages](docs/APP.md) — Routes and page behavior
- [Firestore Schema](docs/FIRESTORE.md) — Collections, fields, rules, indexes
- [Deployment](docs/DEPLOYMENT.md) — Environment setup, build, deploy

## Deploy

Push to Vercel. Set all env vars in project settings. See [Deployment Guide](docs/DEPLOYMENT.md) for details.

## Notes

- **Firestore rules** are set to test mode (allow all until 2026-06-26). Update before production.
- **Data Connect** (`dataconnect/`) contains boilerplate movie-review schema from Firebase init — not used by the app.
- **Cloud Functions** (`functions/`) is a stub with no active functions.
- **Firestore indexes** (`firestore.indexes.json`) is empty — create composite indexes via Firebase Console as needed.
