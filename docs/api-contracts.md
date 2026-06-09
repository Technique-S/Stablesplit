# API Contracts

## Overview

StableSplit uses **Next.js Route Handlers** (`app/api/`) as the server-side API layer. All endpoints require wallet-based authentication via the `x-wallet-address` header, verified server-side against Firestore.

### Auth Pattern

- `x-wallet-address` header containing the user's EVM wallet address (lowercased)
- Server verifies the caller belongs to the target group or owns the profile
- Authentication through `lib/api-utils.ts` (`verifyAuth`)

---

## Groups

### `POST /api/groups` — Create Group

**Auth:** Required (creator)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Group name (1-100 chars) |
| description | string | no | Group description |
| members | Member[] | yes | At least 1 member |
| memberWallets | Record<string, string> | no | Wallet address map |
| currency | string | no | 3-letter code (default: USD) |
| templateType | string | no | Template identifier |
| profileId | string | no | Creator's profile ID |
| createdBy | string | no | Wallet address override |

**Response:** `201` `{ groupId: string }`

**Side Effects:** Creates activity records (`group.created`, `invite.generated`)

---

### `GET /api/groups` — List User Groups

**Auth:** Required

**Query Params:** None

**Response:** `{ groups: Group[] }` — Groups sorted by creation, created groups first

---

### `PATCH /api/groups/[id]` — Update Group

**Auth:** Required (member)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | no | Updated name |
| description | string | no | Updated description |
| currency | string | no | Updated currency |
| members | Member[] | no | Updated members |
| memberWallets | Record<string, string> | no | Updated wallets |
| photoURL | string | no | Updated image URL |
| templateType | string | no | Updated template |
| operation | string | no | `"addMember"` or `"updateWallet"` |
| member | Member | if addMember | New member to add |
| memberId | string | if updateWallet | Target member ID |
| walletAddress | string | if updateWallet | New wallet address |

**Response:** `{ success: true }`

---

### `DELETE /api/groups/[id]` — Delete Group

**Auth:** Required (creator only)

**Response:** `{ success: true }`

**Side Effects:** Deletes group and all subcollections via batch

---

### `POST /api/groups/join` — Join Group by Invite

**Auth:** Required

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| inviteCode | string | yes | 8-character invite code |
| displayName | string | yes | Joiner's display name |
| walletAddress | string | no | Joiner's wallet |
| includeInUnsettled | boolean | no | Include in existing expense splits |
| profileId | string | no | Joiner's profile ID |

**Response:** `{ groupId: string, groupName: string, alreadyMember?: boolean }`

---

## Expenses

### `POST /api/expenses` — Create Expense

**Auth:** Required (group member)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| groupId | string | yes | Parent group ID |
| description | string | yes | Expense description |
| amount | number | yes | Positive amount |
| paidBy | string | yes | Member who paid |
| splitAmong | string[] | yes | Members to split with |
| category | enum | yes | `food`, `transport`, `accommodation`, `entertainment`, `utilities`, `other` |
| date | number | no | Timestamp |
| notes | string | no | Optional notes |
| recurrence | RecurrenceConfig | no | Recurring expense config |
| originalCurrency | string | no | Original currency code |
| baseUsdAmount | number | no | Converted USD amount |
| baseEurAmount | number | no | Converted EUR amount |
| fxRate | number | no | Exchange rate used |

**Response:** `201` `{ expenseId: string }`

**Side Effects:** Creates activity record (`expense.created`)

---

### `DELETE /api/expenses/[id]` — Delete Expense

**Auth:** Required (group member)

**Request Body:** `{ groupId: string }`

**Response:** `{ success: true }`

---

## Settlements

### `POST /api/settlements` — Create/Update Settlement

**Auth:** Required (group member)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| groupId | string | yes | Parent group |
| settlementKey | string | yes | Unique settlement key |
| from | string | yes | Payer name |
| to | string | yes | Receiver name |
| payerWallet | string | no | Payer's wallet address |
| receiverWallet | string | no | Receiver's wallet address |
| amount | number | yes | Settlement amount |
| currency | enum | yes | `USDC` or `EUR` |
| status | enum | yes | `pending`, `paid`, `failed` |
| txHash | string | no | Blockchain tx hash |
| batchId | string | no | Batch settlement ID |

**Response:** `{ success: true }`

**Side Effects:** On `paid`: locks expenses via `lockedAt`, updates `firstSettlementAt`, creates activity record

### `GET /api/settlements?groupId=X` — List Settlements

**Auth:** Required

**Response:** `{ payments: SettlementPayment[] }`

---

## Profiles

### `POST /api/profiles` — Create/Update Profile

**Auth:** Required

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| displayName | string | no | User display name |
| avatarURL | string | no | Avatar image URL |
| walletAddress | string | no | EVM wallet address |

**Response:** `201` `{ profile: UserProfile }`

**Side Effects:** Creates/reads wallet link, migrates legacy profiles

### `PATCH /api/profiles` — Update Profile Fields

**Auth:** Required

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| displayName | string | no | Updated name |
| avatarURL | string | no | Updated avatar |
| walletAddress | string | no | Updated wallet |
| profileId | string | no | Target profile ID |
| joinedGroupIds.$addToSet | string | no | Add group to joined list |
| createdGroupIds.$addToSet | string | no | Add group to created list |

**Response:** `{ success: true }`

---

## Activity

### `POST /api/activity` — Create Activity Record

**Auth:** Required (group member)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| groupId | string | yes | Parent group |
| eventType | ActivityEventType | yes | Event type enum |
| description | string | yes | Human-readable description |
| metadata | object | no | Event metadata |
| actorName | string | no | Actor display name |

**Response:** `{ success: true }`

---

## Demo

### `POST /api/demo` — Generate Demo Group

**Auth:** Required

**Request Body:** (empty)

**Response:** `{ groupId: string }`

**Side Effects:** Creates a demo group "Weekend Trip" with 5 mock members (Lou, Ada, John, Sarah, Mike), predefined expenses, and mock wallets for testing. Checks for existing demo group first to avoid duplicates.

---

## FX Rates

### `GET /api/rates` — Get Exchange Rates

**Auth:** Required

**Response:** `{ rates: Record<string, number> }` — Conversion rates from exchangerate-api.com, based on USD.

---

## Common Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation error (Zod schema) or bad request |
| 401 | Missing or invalid wallet authentication |
| 403 | Not a member of the target group |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate pending settlement) |
| 500 | Internal server error |
