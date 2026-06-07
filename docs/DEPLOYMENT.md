# Deployment Guide

## Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_REOWN_PROJECT_ID=
```

### Where to get values

- **Firebase vars** — Firebase Console > Project Settings > General > Your apps > Web app
- **Reown Project ID** — https://cloud.reown.com (create a project, copy the Project ID)

### `next.config.ts`

Configures Turbopack alias `accounts` -> `lib/wallet-empty-accounts.ts`. This is used during development and build — no changes needed for deployment.

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (start in test mode for development)
3. Enable **Storage** (for image uploads)
4. Deploy Firestore indexes once determined (current `firestore.indexes.json` is empty)
5. Update `firestore.rules` for production access control

## Wallet / Blockchain Setup

1. Create a project at https://cloud.reown.com
2. Copy the Project ID to `NEXT_PUBLIC_REOWN_PROJECT_ID`
3. The app is configured for **Arc Testnet** (chain ID 5042002)
   - Native currency: ARC
   - USDC contract: `0x...` (defined in `lib/arc-payments.ts`)
   - EUR contract: `0x...` (defined in `lib/arc-payments.ts`)
4. Users need ARC testnet tokens for gas fees + USDC/EUR for settlements
   - Faucet link available in WalletConnectButton dropdown

## Build & Deploy

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint
npm run lint
```

## Hosting Options

### Vercel (recommended for Next.js)
1. Push to GitHub
2. Import repo in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy

### Firebase Hosting
1. `npm install -g firebase-tools`
2. `firebase init hosting` — point to `out/` for static export
3. Note: Full Next.js features (API routes, SSR) require a Node.js server — Firebase Hosting supports static exports only. For SSR, use Vercel.

## Firebase Cloud Functions

The `functions/` directory contains a stub (`functions/src/index.ts` with commented-out boilerplate). No active cloud functions are deployed. If needed:
1. `cd functions && npm install`
2. Implement functions in `functions/src/index.ts`
3. `firebase deploy --only functions`

## Firebase Data Connect

The `dataconnect/` directory contains a generic movie-review schema from `firebase init dataconnect`. **It is unrelated to the app and not used.** It can be removed or repurposed. The generated SDK lives at `src/dataconnect-generated/`.

## Important Notes

- **Firestore indexes** — The app may fail on sorted queries without composite indexes. Monitor Firebase Console > Firestore > Indexes for "index required" errors after deployment.
- **Security rules** — Current rules allow all reads/writes until 2026-06-26. Update before production launch.
- **Functions** — No scheduled functions exist for recurring expense generation. This is handled client-side on group page load.
- **Push notifications** — Not yet implemented (stubs in the notification system exist but Firebase Cloud Messaging is not configured).
