# StableSplit Architecture

## Overview

StableSplit is a Next.js web application for splitting expenses among groups with optional on-chain settlement via ARC-20 tokens on the Arc Testnet blockchain. Users create groups, add expenses with customizable split rules, view balances, and optionally settle debts with stablecoins (USDC / EUR).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack, App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Firebase Firestore |
| Auth | Reown AppKit (wallet-based, no email/password) |
| Blockchain | Arc Testnet (chain ID 5042002) via Wagmi + Viem |
| Storage | Firebase Storage (avatars, group images) |
| Export | jsPDF + html2canvas (PDF), custom CSV generation |
| FX Rates | exchangerate-api.com (with localStorage cache) |
| Push Notifications | Not yet configured (Firebase Cloud Messaging stubs exist) |

## High-Level Data Flow

```
User Wallet (Reown AppKit)
      |
      v
Next.js App (App Router)
      |
      ├── Firebase Firestore ─── Collections: groups, users, expenses, etc.
      ├── Firebase Storage ───── Group & profile images
      ├── Blockchain (Arc) ───── Settlement payments (USDC / EUR)
      └── Local State ────────── Theme, profile ID, FX rate cache
```

## Directory Structure

```
stablesplit/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx           # Root layout (Theme, Wallet, Profile providers)
│   ├── page.tsx             # Dashboard
│   ├── create/              # Group creation
│   ├── group/[id]/          # Group detail (expenses, balances, settle, history)
│   ├── profile/             # User profile
│   ├── join/[inviteCode]/   # Join group by invite code
│   ├── create-profile/      # First-time profile creation
│   └── report/[groupId]/    # Static report view
├── components/              # Reusable UI components
├── lib/                     # Business logic & data access
├── functions/               # Firebase Cloud Functions (stub — not active)
├── dataconnect/             # Firebase Data Connect (movie review boilerplate — unused)
├── public/                  # Static assets
└── docs/                    # Documentation
```

## Routing & Providers

The root layout (`app/layout.tsx`) nests providers in order:

1. **ThemeProvider** — Light/dark mode with localStorage persistence
2. **WalletProvider** — Wagmi + Reown AppKit for wallet connection
3. **ProfileGuard** — Redirects unprofiled wallets to `/create-profile`

## Key Dependencies (package.json)

- `next` — Framework
- `react`, `react-dom` — UI
- `firebase` — Firestore, Auth, Storage
- `@reown-io/appkit` — Wallet connection UI
- `wagmi`, `viem` — EVM blockchain interaction
- `@tailwindcss/postcss` — Tailwind v4 PostCSS plugin
- `jspdf`, `html2canvas` — PDF report generation
- `lucide-react` — Icons

## Documentation Gaps (known)

- **Data Connect** (`dataconnect/`) contains a generic movie-review schema from Firebase init — it is unrelated to the app and not used.
- **Firebase Cloud Functions** (`functions/src/index.ts`) is a stub with no active functions.
- **Firestore indexes** (`firestore.indexes.json`) is empty — the app may need composite indexes for sorted queries (create via Firebase Console).
- **Firestore security rules** (`firestore.rules`) are set to test mode (allow all until 2026-06-26) — not production-ready.
