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

export async function addActivity(
  groupId: string,
  eventType: string,
  description: string,
  metadata: Record<string, unknown> = {},
  actorName = "StableSplit"
): Promise<void> {
  await adminDb.collection("groups").doc(groupId).collection("activity").add({
    groupId,
    eventType,
    actorName,
    description,
    metadata,
    createdAt: serverTimestamp(),
  });
}

export async function resolveProfileId(walletAddress: string): Promise<string | null> {
  const addr = walletAddress.trim().toLowerCase();

  const linkSnap = await adminDb.collection("walletLinks").doc(addr).get();
  if (linkSnap.exists) {
    return linkSnap.data()!.profileId as string;
  }

  const legacySnap = await adminDb.collection("users").doc(addr).get();
  if (legacySnap.exists) {
    const data = legacySnap.data()!;
    return (data.profileId as string) || addr;
  }

  return null;
}

export function mapGroupResponse(data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: data.id,
    name: data.name ?? "",
    description: data.description ?? "",
    members: data.members ?? [],
    memberWallets: data.memberWallets ?? {},
    currency: data.currency ?? "USD",
    createdAt: data.createdAt,
    firstSettlementAt: data.firstSettlementAt,
    isDemo: data.isDemo ?? false,
    inviteCode: data.inviteCode,
    photoURL: data.photoURL,
    templateType: data.templateType,
    createdBy: data.createdBy,
  };
}
