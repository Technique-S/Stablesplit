# Phase 3 Changelog — Architecture Reorganization

**Date:** 2026-06-25

**Verification:** `pnpm build` — compiles successfully. All 16 routes generated. Zero new warnings.

**Rollback:** Commit `17185ce` (pre-Phase 3). Final state at commit `313e3aa`.

---

## 1. `lib/` Reorganization

Previously 26 files flat in `lib/`. Now organized into 4 subdirectories with 6 files remaining at root.

### Root (stayed)
| File | Reason |
|------|--------|
| `lib/types.ts` | Foundational type definitions — imported by all layers |
| `lib/timestamp.ts` | Zero-dependency utility used across all layers |
| `lib/errors.ts` | Zero-dependency utility used across all layers |
| `lib/calculations.ts` | Core business logic — pure functions, no I/O |
| `lib/export.ts` | Utility that imports from domain layer |
| `lib/use-profile-check.ts` | Custom hook (client-only, but no Firebase dependency) |

### `lib/domain/` — Pure business domain logic
| File | Source |
|------|--------|
| `members.ts` | `lib/members.ts` |
| `schemas.ts` | `lib/schemas.ts` |
| `date-utils.ts` | `lib/date-utils.ts` |
| `activity-helpers.ts` | `lib/activity-helpers.ts` |
| `format.ts` | `lib/format.ts` |
| `recurrence.ts` | `lib/recurrence.ts` |
| `templates.ts` | `lib/templates.ts` |
| `rates.ts` | `lib/rates.ts` |

### `lib/client/` — Client-side Firebase operations
| File | Source |
|------|--------|
| `firebase.ts` | `lib/firebase.ts` |
| `api-client.ts` | `lib/api-client.ts` |
| `db.ts` | `lib/db.ts` |
| `profile.ts` | `lib/profile.ts` |
| `local-profile.ts` | `lib/local-profile.ts` |
| `notifications.ts` | `lib/notifications.ts` |
| `image-upload.ts` | `lib/image-upload.ts` |

### `lib/server/` — Server-side only (Node.js)
| File | Source |
|------|--------|
| `firebase-admin.ts` | `lib/firebase-admin.ts` |
| `api-utils.ts` | `lib/api-utils.ts` |

### `lib/web3/` — Blockchain
| File | Source |
|------|--------|
| `wallet.ts` | `lib/wallet.ts` |
| `arc-payments.ts` | `lib/arc-payments.ts` |

### Dependency direction
```
types ─┬→ domain ─┬→ client
       │           ├→ server
       │           └→ web3
       │
       └→ calculations ─→ components
         export      ─→ components
```

---

## 2. `components/` Reorganization

Previously 22 files flat (only 3 in `ui/`). Now organized into 7 subdirectories.

### `components/ui/` — Generic reusable primitives (unchanged)
- `Modal.tsx`, `Skeleton.tsx`, `Toast.tsx`, `FillWalletButton.tsx`

### `components/layout/` — App shell
| File | Source |
|------|--------|
| `Navbar.tsx` | `components/Navbar.tsx` |
| `ThemeProvider.tsx` | `components/ThemeProvider.tsx` |
| `NotificationBell.tsx` | `components/NotificationBell.tsx` |
| `FloatingActionMenu.tsx` | `components/FloatingActionMenu.tsx` |

### `components/wallet/` — Web3 UI
| File | Source |
|------|--------|
| `WalletConnectButton.tsx` | `components/WalletConnectButton.tsx` |
| `WalletProvider.tsx` | `components/WalletProvider.tsx` |

### `components/profile/` — User profile UI
| File | Source |
|------|--------|
| `ProfileAvatarUpload.tsx` | `components/ProfileAvatarUpload.tsx` |
| `ProfileGuard.tsx` | `components/ProfileGuard.tsx` |

### `components/group/` — Group management UI
| File | Source |
|------|--------|
| `GroupSettingsModal.tsx` | `components/GroupSettingsModal.tsx` |
| `MemberWalletModal.tsx` | `components/MemberWalletModal.tsx` |
| `GroupImageUpload.tsx` | `components/GroupImageUpload.tsx` |

### `components/expense/` — Expense & settlement UI
| File | Source |
|------|--------|
| `AddExpenseModal.tsx` | `components/AddExpenseModal.tsx` |
| `SettleAllModal.tsx` | `components/SettleAllModal.tsx` |
| `SettlementPaymentButton.tsx` | `components/SettlementPaymentButton.tsx` |
| `ExportModal.tsx` | `components/ExportModal.tsx` |

### `components/shared/` — Compound reusable components
| File | Source |
|------|--------|
| `AccordionSection.tsx` | `components/AccordionSection.tsx` |
| `ConfirmModal.tsx` | `components/ConfirmModal.tsx` |
| `OnboardingScreen.tsx` | `components/OnboardingScreen.tsx` |
| `TemplatePicker.tsx` | `components/TemplatePicker.tsx` |

---

## 3. Import Updates

- **42 files** with import path changes across `lib/`, `components/`, `app/`
- All relative imports in moved files updated to new directory locations
- All `@/lib/...` path aliases updated to reflect new subdirectory structure
- All `@/components/...` path aliases updated to reflect new subdirectory structure
- Cross-component relative imports (`./WalletProvider`, `./ThemeProvider`, etc.) updated

---

## 4. Directory Cleanup

Removed unused directories:
- `stable/` — empty (Phase 1 deleted all files)
- `dataconnect/` — Firebase Data Connect config (dependency removed in Phase 1)
- `src/dataconnect-generated/` — Generated Data Connect code (dependency removed in Phase 1)
- `src/` — now empty after removal above

Retained:
- `functions/` — Active Firebase Cloud Functions (not related to Data Connect)

---

## 5. Summary

| Metric | Count |
|--------|-------|
| Files moved (lib/) | 19 |
| Files moved (components/) | 19 |
| Directories created | 10 |
| Directories deleted | 3 |
| Files with import updates | 42 |
| Build passes | Yes |
| Rollback commit | `17185ce` |
| Phase 3 commit | `313e3aa` |
