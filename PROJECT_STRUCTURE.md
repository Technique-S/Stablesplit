# StableSplit Project Structure

```
stablesplit/
├── app/                          # Next.js App Router
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx                # Root layout (ThemeProvider, WalletProvider, Navbar, ProfileGuard)
│   ├── page.tsx                  # Dashboard — group list, balances, activity
│   │
│   ├── api/                      # API routes (server-side, Node.js)
│   │   ├── activity/route.ts
│   │   ├── demo/route.ts
│   │   ├── expenses/route.ts
│   │   ├── expenses/[id]/route.ts
│   │   ├── groups/route.ts
│   │   ├── groups/[id]/route.ts
│   │   ├── groups/join/route.ts
│   │   ├── profiles/route.ts
│   │   ├── rates/route.ts
│   │   └── settlements/route.ts
│   │
│   ├── create/page.tsx           # Group creation flow
│   ├── create-profile/page.tsx   # Wallet profile creation
│   ├── group/[id]/page.tsx       # Group detail — expenses, balances, settle, history
│   ├── join/[inviteCode]/page.tsx
│   ├── profile/page.tsx          # User profile settings
│   └── report/[groupId]/page.tsx # Group expense report
│
├── components/                   # React components
│   ├── ui/                       # Generic UI primitives
│   │   ├── Modal.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Toast.tsx
│   │   └── FillWalletButton.tsx
│   │
│   ├── layout/                   # App shell
│   │   ├── Navbar.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── NotificationBell.tsx
│   │   └── FloatingActionMenu.tsx
│   │
│   ├── wallet/                   # Web3 UI
│   │   ├── WalletConnectButton.tsx
│   │   └── WalletProvider.tsx
│   │
│   ├── profile/                  # User profile UI
│   │   ├── ProfileAvatarUpload.tsx
│   │   └── ProfileGuard.tsx
│   │
│   ├── group/                    # Group management UI
│   │   ├── GroupSettingsModal.tsx
│   │   ├── MemberWalletModal.tsx
│   │   └── GroupImageUpload.tsx
│   │
│   ├── expense/                  # Expense & settlement UI
│   │   ├── AddExpenseModal.tsx
│   │   ├── SettleAllModal.tsx
│   │   ├── SettlementPaymentButton.tsx
│   │   └── ExportModal.tsx
│   │
│   └── shared/                   # Compound reusable components
│       ├── AccordionSection.tsx
│       ├── ConfirmModal.tsx
│       ├── OnboardingScreen.tsx
│       └── TemplatePicker.tsx
│
├── lib/                          # Utilities, services, business logic
│   ├── types.ts                  # Foundation: Group, Expense, Member, Settlement, etc.
│   ├── timestamp.ts              # Zero-dep utility: toMillis()
│   ├── errors.ts                 # Zero-dep utility: safeExtractMessage(), logError()
│   ├── calculations.ts           # Core business logic: calculateBalances, calculateSettlements
│   ├── export.ts                 # CSV/PDF export utilities
│   └── use-profile-check.ts      # Custom hook: wallet→profile check
│
│   ├── domain/                   # Pure business domain logic (no I/O)
│   │   ├── members.ts            # Member helpers: validateEvmAddress, shortenAddress, etc.
│   │   ├── schemas.ts            # Zod validation schemas
│   │   ├── date-utils.ts         # Date formatting: formatDate, groupActivityByDate, etc.
│   │   ├── activity-helpers.ts   # Activity feed display helpers
│   │   ├── format.ts             # Currency formatting: formatAmount
│   │   ├── recurrence.ts         # Recurring expense helpers
│   │   ├── templates.ts          # Expense template presets
│   │   └── rates.ts              # Exchange rate fetching + cache
│   │
│   ├── client/                   # Client-side (browser) Firebase operations
│   │   ├── firebase.ts           # Firebase client init
│   │   ├── api-client.ts         # Fetch wrapper for API routes
│   │   ├── db.ts                 # Firestore CRUD (client-side)
│   │   ├── profile.ts            # Profile CRUD
│   │   ├── local-profile.ts      # localStorage profile ID
│   │   ├── notifications.ts      # Notification helpers
│   │   └── image-upload.ts       # Firebase Storage upload
│   │
│   ├── server/                   # Server-side only (Node.js)
│   │   ├── firebase-admin.ts     # Firebase Admin init
│   │   └── api-utils.ts          # API middleware: handleZodError, assertGroupMembership, etc.
│   │
│   └── web3/                     # Blockchain
│       ├── wallet.ts             # WalletProvider setup, chain config, Reown AppKit
│       └── arc-payments.ts       # ARC token transfers on testnet
│
├── functions/                    # Firebase Cloud Functions (separate package)
├── public/                       # Static assets
│
├── docs/                         # Project documentation
├── .next/                        # Next.js build output (gitignored)
├── node_modules/                 # Dependencies (gitignored)
│
├── PHASE1_CHANGELOG.md
├── PHASE2_CHANGELOG.md
├── PHASE3_CHANGELOG.md
├── ARCHITECTURE_REVIEW.md
├── DEAD_CODE_REPORT.md
├── DUPLICATION_REPORT.md
├── REFACTOR_PLAN.md
├── PROJECT_STRUCTURE.md
│
├── AGENTS.md                     # Agent rules
├── CLAUDE.md                     # Claude Code project rules
├── next.config.ts                # Next.js config
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── ...
```

## Dependency Direction

```
                    ┌──────────────┐
                    │   lib/types  │  (foundational types)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ lib/     │ │ lib/     │ │ lib/     │
        │ domain/  │ │ client/  │ │ server/  │
        │ web3/    │ │          │ │          │
        │ calc/    │ │          │ │          │
        │ export/  │ │          │ │          │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          v
                   ┌──────────────┐
                   │ components/  │
                   │ (all groups) │
                   └──────┬───────┘
                          v
                   ┌──────────────┐
                   │   app/       │
                   │ (pages)      │
                   └──────────────┘
```

- **domain/** — Pure functions. Dependencies: `lib/types.ts` only.
- **client/** — Browser I/O. Dependencies: `domain/`, `lib/types.ts`, `lib/timestamp.ts`.
- **server/** — Node.js I/O. Dependencies: `lib/types.ts` (via firebase-admin).
- **web3/** — Blockchain. Dependencies: `domain/`, `lib/types.ts`.
- **components/** — React UI. Dependencies: all `lib/` layers.
- **app/** — Pages. Dependencies: `lib/` and `components/`.

## Conventions

- `lib/` files use **relative imports** (`../domain/members`, `./firebase`)
- Components and pages use **`@/lib/...`** and **`@/components/...`** path aliases
- Server-only code stays in `lib/server/` — never imported by client bundles
- Zero circular dependencies verified by build
