# Source Tree Analysis

## Overview

StableSplit is a monolith Next.js application with a standardized directory structure. All application logic lives under `app/`, `components/`, and `lib/`, with supporting files at the root level.

## Directory Structure

```
stablesplit/
│
├── app/                           # Next.js App Router pages & API routes
│   ├── layout.tsx                 # Root layout: ThemeProvider > WalletProvider > Navbar > ProfileGuard
│   ├── page.tsx                   # Dashboard — group list, balances, recent activity
│   ├── globals.css                # Global CSS with light/dark custom properties
│   │
│   ├── create/                    # Group creation flow
│   │   └── page.tsx               # Template picker → group form → submit
│   │
│   ├── create-profile/            # First-time profile setup
│   │   └── page.tsx               # Display name + avatar upload
│   │
│   ├── profile/                   # User profile page
│   │   └── page.tsx               # Edit name, avatar, linked groups
│   │
│   ├── group/[id]/                # Group detail page
│   │   └── page.tsx               # 4 tabs: Expenses, Balances, Settle, History
│   │
│   ├── join/[inviteCode]/         # Join group by invite link
│   │   └── page.tsx               # Invite lookup → preview → join
│   │
│   ├── report/[groupId]/          # Static read-only report
│   │   └── page.tsx               # Print-friendly group report
│   │
│   └── api/                       # Next.js Route Handlers (server-side)
│       ├── groups/route.ts        # POST (create) + GET (list user groups)
│       ├── groups/[id]/route.ts   # PATCH (update) + DELETE (delete)
│       ├── groups/join/route.ts   # POST (join by invite code)
│       ├── expenses/route.ts      # POST (create expense)
│       ├── expenses/[id]/route.ts # DELETE (delete expense)
│       ├── settlements/route.ts   # POST (create/update) + GET (list)
│       ├── profiles/route.ts      # POST (upsert) + PATCH (update fields)
│       ├── activity/route.ts      # POST (create activity record)
│       ├── demo/route.ts          # POST (generate demo group)
│       └── rates/route.ts         # GET (fetch FX rates)
│
├── components/                    # Reusable React components
│   ├── Navbar.tsx                 # Top navigation with logo, links, theme, wallet
│   ├── WalletProvider.tsx         # Wagmi + Reown AppKit provider wrapper
│   ├── ThemeProvider.tsx          # Light/dark theme context with localStorage
│   ├── ProfileGuard.tsx           # Route guard: redirects to /create-profile
│   ├── OnboardingScreen.tsx       # Landing page when no wallet connected
│   ├── AccordionSection.tsx       # Collapsible section wrapper
│   ├── FloatingActionMenu.tsx     # FAB with Add Expense, Settle, Export, Settings
│   ├── AddExpenseModal.tsx        # Expense creation form (modal)
│   ├── SettleAllModal.tsx         # Batch settlement modal
│   ├── SettlementPaymentButton.tsx# Single settlement with blockchain tx
│   ├── ExportModal.tsx            # CSV/PDF export modal
│   ├── ConfirmModal.tsx           # Generic confirmation dialog
│   ├── GroupSettingsModal.tsx     # Group edit modal
│   ├── MemberWalletModal.tsx      # Wallet address editor
│   ├── GroupImageUpload.tsx       # Group avatar upload (crop + compress)
│   ├── ProfileAvatarUpload.tsx    # Profile avatar upload
│   ├── TemplatePicker.tsx         # Group template selector grid
│   ├── NotificationBell.tsx       # Notification list dropdown
│   └── WalletConnectButton.tsx    # Wallet connection button
│
├── lib/                           # Business logic & data access
│   ├── types.ts                   # All TypeScript interfaces & types
│   ├── firebase.ts                # Firebase client SDK init (db, storage)
│   ├── firebase-admin.ts          # Firebase Admin SDK (server-side)
│   ├── api-utils.ts               # API helper (verifyAuth, okResponse, etc.)
│   ├── api-client.ts              # Client-side fetch wrapper
│   ├── db.ts                      # Firestore CRUD (groups, expenses, settlements)
│   ├── calculations.ts            # Balance math & settlement optimization
│   ├── members.ts                 # Member utilities (creation, normalization)
│   ├── profile.ts                 # User profile CRUD
│   ├── local-profile.ts           # Profile ID from wallet address
│   ├── use-profile-check.ts       # React hook: check profile existence
│   ├── recurrence.ts              # Recurring expense logic
│   ├── rates.ts                   # FX rate fetching with localStorage cache
│   ├── export.ts                  # CSV & PDF generation
│   ├── templates.ts               # Group creation templates
│   ├── image-upload.ts            # Client-side image compression
│   ├── notifications.ts           # In-app notification CRUD
│   ├── arc-payments.ts            # ARC-20 token contract interactions
│   ├── wallet.ts                  # Wagmi config & chain definitions
│   └── wallet-empty-accounts.ts   # Empty alias stub for Turbopack
│
├── docs/                          # Project documentation
│   ├── ARCHITECTURE.md            # Tech stack, data flow, directory structure
│   ├── APP.md                     # Page routes and behaviors
│   ├── COMPONENTS.md              # Component inventory and descriptions
│   ├── LIB.md                     # Library modules documentation
│   ├── FIRESTORE.md               # Database schema and security rules
│   ├── DEPLOYMENT.md              # Deployment guide and environment setup
│   ├── api-contracts.md           # API endpoint documentation
│   ├── source-tree-analysis.md    # This file
│   └── index.md                   # Master documentation index
│
├── functions/                     # Firebase Cloud Functions (stub — not active)
│   └── src/index.ts               # Empty stub
│
├── dataconnect/                   # Firebase Data Connect (unused boilerplate)
│
├── public/                        # Static assets (favicon, etc.)
│
├── stable/                        # Work-in-progress directory
│
├── .env.local                     # Environment variables (gitignored)
├── .env.example                   # Environment variable template
├── next.config.ts                 # Next.js + Turbopack configuration
├── tsconfig.json                  # TypeScript configuration
├── postcss.config.mjs             # PostCSS + Tailwind config
├── package.json                   # Dependencies and scripts
└── firestore.rules                # Firestore security rules (test mode)
```

## Architecture Pattern

Layered architecture with the Next.js App Router as the routing layer:

1. **Client Layer** (`app/` pages + `components/`) — React components with `"use client"` directives
2. **Service Layer** (`lib/`) — Business logic, data access, blockchain interactions
3. **API Layer** (`app/api/`) — Server-side Route Handlers for write operations
4. **Data Layer** (Firebase Firestore + Storage) — Database and file storage
5. **Blockchain Layer** (Arc Testnet) — On-chain settlement via ARC-20 tokens

## Entry Points

| Entry Point | Path | Type |
|-------------|------|------|
| Application | `app/layout.tsx` | Root layout (providers) |
| Dashboard | `app/page.tsx` | Client page |
| API Routes | `app/api/` | Server handlers |
| Firebase Init | `lib/firebase.ts` | Client SDK |
| Firebase Admin | `lib/firebase-admin.ts` | Server SDK |

## Key Integration Points

- **Client → API**: Fetch-based calls through `lib/api-client.ts` with wallet address header
- **Client → Firestore**: Direct reads via `lib/db.ts` using Firebase client SDK
- **Client → Blockchain**: Wagmi/Viem through `lib/arc-payments.ts`
- **API → Firestore**: Admin SDK writes in Route Handlers
