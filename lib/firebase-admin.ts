import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_KEY is not set. " +
    "Go to Firebase Console > Project Settings > Service Accounts > Generate new private key, " +
    "then paste the entire JSON into .env.local as FIREBASE_SERVICE_ACCOUNT_KEY={\"type\":\"service_account\",...}"
  );
}

const serviceAccount = JSON.parse(raw);

const app = getApps().length === 0
  ? initializeApp({ credential: cert(serviceAccount) })
  : getApps()[0];

export const adminDb = getFirestore(app);
adminDb.settings({ ignoreUndefinedProperties: true });

export const serverTimestamp = FieldValue.serverTimestamp;
