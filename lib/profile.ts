import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { UserProfile } from "./types";

export function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapUserProfile(id: string, data: Record<string, unknown>): UserProfile {
  return {
    id,
    displayName: (data.displayName as string) ?? "",
    avatarURL: (data.avatarURL as string) ?? undefined,
    walletAddress: (data.walletAddress as string) ?? undefined,
    joinedGroupIds: Array.isArray(data.joinedGroupIds) ? data.joinedGroupIds as string[] : [],
    createdGroupIds: Array.isArray(data.createdGroupIds) ? data.createdGroupIds as string[] : [],
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt ?? data.createdAt),
  };
}

export async function getProfile(profileId: string): Promise<UserProfile | null> {
  if (!profileId) return null;
  try {
    const snap = await getDoc(doc(db, "users", profileId));
    if (!snap.exists()) return null;
    return mapUserProfile(profileId, snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function upsertProfile(
  input: Partial<Pick<UserProfile, "displayName" | "avatarURL" | "walletAddress">>,
  profileId: string
): Promise<UserProfile | null> {
  if (!profileId) return null;
  const existing = await getProfile(profileId);
  const now = serverTimestamp();
  const payload: Record<string, unknown> = {
    ...(existing ? {} : { createdAt: now }),
    updatedAt: now,
  };
  if (input.displayName !== undefined) payload.displayName = input.displayName;
  if (input.avatarURL !== undefined) payload.avatarURL = input.avatarURL;
  if (input.walletAddress !== undefined) payload.walletAddress = input.walletAddress;
  if (!existing) {
    payload.displayName = payload.displayName || "";
    payload.joinedGroupIds = [];
    payload.createdGroupIds = [];
    (payload as Record<string, unknown>).createdAt = now;
  }
  await setDoc(doc(db, "users", profileId), payload, { merge: true });
  return getProfile(profileId);
}

export async function addJoinedGroupId(groupId: string, profileId: string): Promise<void> {
  if (!profileId) return;
  const profile = await getProfile(profileId);
  if (!profile) return;
  const joined = profile.joinedGroupIds;
  if (!joined.includes(groupId)) {
    await updateDoc(doc(db, "users", profileId), {
      joinedGroupIds: [...joined, groupId],
      updatedAt: serverTimestamp(),
    });
  }
}

export async function addCreatedGroupId(groupId: string, profileId: string): Promise<void> {
  if (!profileId) return;
  const profile = await getProfile(profileId);
  if (!profile) return;
  const joined = profile.joinedGroupIds;
  const created = profile.createdGroupIds;
  if (!joined.includes(groupId)) {
    await updateDoc(doc(db, "users", profileId), {
      joinedGroupIds: [...joined, groupId],
      createdGroupIds: [...created, groupId],
      updatedAt: serverTimestamp(),
    });
    return;
  }
  if (!created.includes(groupId)) {
    await updateDoc(doc(db, "users", profileId), {
      createdGroupIds: [...created, groupId],
      updatedAt: serverTimestamp(),
    });
  }
}

export async function uploadProfileAvatar(profileId: string, file: Blob): Promise<string> {
  const storageRef = ref(storage, `users/${profileId}/avatar.jpg`);
  const snapshot = await uploadBytes(storageRef, file);
  const avatarURL = await getDownloadURL(snapshot.ref);
  await updateDoc(doc(db, "users", profileId), { avatarURL, updatedAt: serverTimestamp() });
  return avatarURL;
}

export async function updateProfileDisplayName(displayName: string, profileId: string): Promise<void> {
  if (!profileId) return;
  await updateDoc(doc(db, "users", profileId), { displayName, updatedAt: serverTimestamp() });
}

export async function updateProfileWallet(walletAddress: string, profileId: string): Promise<void> {
  if (!profileId) return;
  await updateDoc(doc(db, "users", profileId), { walletAddress: walletAddress || "", updatedAt: serverTimestamp() });
}