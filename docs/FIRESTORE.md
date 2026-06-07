# Firestore Schema

## Collections

### `groups`
Document ID: Auto-generated

| Field | Type | Description |
|-------|------|-------------|
| name | string | Group display name |
| description | string | Optional description |
| currency | string | Default currency code (USD, EUR, etc.) |
| members | Member[] | Array of member objects |
| inviteCode | string | Unique invite code for joining |
| imageUrl | string | Optional group avatar URL |
| createdAt | Timestamp | Creation timestamp |
| createdBy | string | Creator's profile ID |

**Member sub-object:**
| Field | Type | Description |
|-------|------|-------------|
| uid | string | Unique member ID (auto-generated or profile ID) |
| displayName | string | Member display name |
| email | string | Optional email |
| phone | string | Optional phone |
| walletAddress | string | Optional EVM wallet address (0x...) |

### `groups/{id}/expenses`
Subcollection of groups. Document ID: Auto-generated.

| Field | Type | Description |
|-------|------|-------------|
| title | string | Expense title |
| amount | number | Amount (as float string or number) |
| currency | string | Currency code |
| paidBy | string | Member UID who paid |
| splits | Split[] | Per-member split breakdown |
| category | string | Category slug (food, rent, etc.) |
| date | string | ISO date string |
| recurrenceConfig | RecurrenceConfig | Optional recurring config |
| createdAt | Timestamp | Creation timestamp |

**Split sub-object:**
| Field | Type | Description |
|-------|------|-------------|
| uid | string | Member UID |
| amount | number | Amount owed |
| percentage | number | Optional percentage share |
| shares | number | Optional equal-shares count |

### `groups/{id}/settlementPayments`
Subcollection of groups. Document ID: Auto-generated.

| Field | Type | Description |
|-------|------|-------------|
| from | string | Payer member UID |
| to | string | Receiver member UID |
| amount | string | Amount as string (wei-compatible) |
| tokenAddress | string | Token contract address |
| currency | string | Currency code |
| txHash | string | Blockchain transaction hash |
| status | string | pending / confirming / confirmed / failed |
| createdAt | Timestamp | Creation timestamp |

### `groups/{id}/activity`
Subcollection of groups. Document ID: Auto-generated.

| Field | Type | Description |
|-------|------|-------------|
| type | string | Activity type (expense_added, member_joined, settlement_completed, etc.) |
| message | string | Human-readable activity description |
| userId | string | Actor profile ID |
| timestamp | Timestamp | When activity occurred |

### `users`
Document ID: Lowercased wallet address (0x...).

| Field | Type | Description |
|-------|------|-------------|
| name | string | User display name |
| walletAddress | string | EVM wallet address |
| avatarUrl | string | Optional avatar URL |
| groupIds | string[] | Array of group IDs the user belongs to |
| createdAt | Timestamp | Creation timestamp |

### `notifications` (top-level)
Document ID: Auto-generated.

| Field | Type | Description |
|-------|------|-------------|
| userId | string | Target user profile ID |
| type | string | Notification type |
| message | string | Notification text |
| groupId | string | Optional related group ID |
| read | boolean | Whether notification has been read |
| timestamp | Timestamp | Creation timestamp |

## Security Rules (firestore.rules)

Currently set to test mode: all reads and writes allowed for authenticated requests, expiring 2026-06-26. **Not production-ready** — must be tightened before deployment.

Recommended production rules:
- Users can read/write only their own `users/{userId}` document
- Group read/write only for members of that group
- Subcollections inherit parent group access rules
- Notifications readable only by the target userId

## Indexes (firestore.indexes.json)

Currently empty. The app may require composite indexes for queries that combine filters with `orderBy`. Examples that may need indexes:
- `groups/{id}/expenses` ordered by `date` descending
- `groups/{id}/activity` ordered by `timestamp` descending
- `notifications` filtered by `userId` and ordered by `timestamp`

Create these indexes via Firebase Console > Firestore > Indexes.
