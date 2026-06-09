# Project Overview: StableSplit

## Executive Summary

StableSplit is a modern expense-splitting web application with optional on-chain settlement via ARC-20 tokens on Arc Testnet. Users create groups, add shared expenses with customizable splitting, track per-member balances, and settle debts using stablecoins (USDC/EUR) through their EVM wallet.

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (Turbopack, App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties (light/dark theme) |
| Database | Firebase Firestore (subcollections: expenses, settlements, activity) |
| Auth | Reown AppKit (wallet-based — no email/password) |
| Blockchain | Arc Testnet (chain ID 5042002) via Wagmi + Viem |
| Storage | Firebase Storage (group & profile avatars) |
| Export | jsPDF + html2canvas (PDF), custom CSV generation |
| FX Rates | exchangerate-api.com with localStorage cache (6h TTL) |
| Icons | lucide-react |
| Validation | Zod (server-side API request validation) |
| Icons/Categories | Emoji-based category icons |

## Architecture Classification

- **Type:** Monolith (single Next.js application)
- **Pattern:** Layered (Client → API → Firestore/Blockchain)
- **Authentication:** Wallet-based (EVM, no email/password)
- **State Management:** React local state + URL params
- **API Style:** Next.js Route Handlers (server-side), Firebase client SDK (reads)

## Repository Structure

**Repository Type:** Monolith
**Primary Language:** TypeScript
**Parts:** 1 (Next.js web application)

## Key Features

- **Group expense tracking** — Create groups with invite codes, add expenses with categories
- **Auto balance calculation** — Per-member net balances with optimized minimum-transfer settlement
- **Multi-currency support** — 8 currencies (USD, EUR, GBP, NGN, JPY, CAD, AUD, INR) with real-time FX conversion
- **On-chain settlements** — Pay debts with USDC or EUR ARC-20 tokens on Arc Testnet
- **Recurring expenses** — Weekly/monthly/quarterly/yearly repeating expenses
- **Group templates** — Pre-built category sets (roommates, trip, friends, project, event)
- **In-app notifications** — Activity alerts with read/unread tracking, stored per-user in Firestore
- **Data export** — CSV (expenses, settlements, activity) + full PDF reports
- **Demo mode** — One-click demo group generation with mock data
- **Light/dark theme** — Persisted to localStorage, synced with system preference

## Getting Started

```bash
# Install
npm install

# Development
npm run dev

# Production build
npm run build

# Start
npm start
```

Requires environment variables in `.env.local`: Firebase config (API key, auth domain, project ID, storage bucket, sender ID, app ID) and Reown Project ID.

## On-Chain Details

- **Network:** Arc Testnet (chain ID 5042002)
- **Native Token:** USDC (6 decimals)
- **USDC Contract:** `0x3600000000000000000000000000000000000000`
- **EUR Contract:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`
- **RPC:** `https://rpc.testnet.arc.network`
- **Explorer:** `https://testnet.arcscan.app`
- **Faucet:** `https://faucet.circle.com`

## Documentation Index

For detailed documentation, see the [master index](./index.md).
