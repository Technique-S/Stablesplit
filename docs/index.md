# StableSplit Documentation Index

## Project Overview

- **Type:** Monolith (single Next.js application)
- **Primary Language:** TypeScript
- **Architecture:** Layered (Client → API → Firestore/Blockchain)
- **Framework:** Next.js 16 (Turbopack, App Router)

### Quick Reference

- **Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Firebase Firestore, Reown AppKit, Wagmi/Viem, Arc Testnet
- **Entry Point:** `app/layout.tsx` (provider chain)
- **Auth:** Wallet-based (EVM, no email/password)
- **Port:** 3000 (development)

---

## Generated Documentation

- [Project Overview](./project-overview.md) — Executive summary, tech stack, architecture classification
- [Architecture](./ARCHITECTURE.md) — Tech stack, data flow, directory structure, providers
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure, entry points, integrations
- [Component Inventory](./COMPONENTS.md) — All 18 UI components documented
- [Library Modules](./LIB.md) — All lib/ modules (types, db, calculations, wallet, etc.)
- [API Contracts](./api-contracts.md) — All 11 API endpoints with schemas and auth requirements
- [Data Models (Firestore)](./FIRESTORE.md) — Collections, fields, subcollections, security rules, indexes
- [App Pages](./APP.md) — All 7 routes with states, data flow, and behaviors
- [Development Guide](./DEPLOYMENT.md) — Setup, build, deploy, environment config

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Connect an EVM wallet to get started. See [Deployment Guide](./DEPLOYMENT.md) for full setup instructions.
