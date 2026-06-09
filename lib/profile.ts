import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { UserProfile } from "./types";
import { apiRequest } from "./api-client";
import { setProfileId } from "./local-profile";

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

function legacyWalletId(address: string): string {
  return address.trim().toLowerCase();
}

export async function getProfileByWalletAddress(walletAddress: string): Promise<UserProfile | null> {
  if (!walletAddress) return null;
  const addr = walletAddress.trim().toLowerCase();

  try {
    const linkSnap = await getDoc(doc(db, "walletLinks", addr));
    if (linkSnap.exists()) {
      const profileId = linkSnap.data()!.profileId as string;
      const profileSnap = await getDoc(doc(db, "users", profileId));
      if (profileSnap.exists()) {
        setProfileId(profileId);
        return mapUserProfile(profileId, profileSnap.data() as Record<string, unknown>);
      }
    }

    const legacySnap = await getDoc(doc(db, "users", addr));
    if (legacySnap.exists()) {
      const legacyData = legacySnap.data() as Record<string, unknown>;
      const migratedId = legacyData.profileId as string || addr;
      setProfileId(migratedId);
      return mapUserProfile(migratedId, legacyData);
    }

    return null;
  } catch {
    return null;
  }
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
  walletAddress: string
): Promise<UserProfile | null> {
  const result = await apiRequest<{ profile: UserProfile }>("POST", "/api/profiles", {
    displayName: input.displayName,
    avatarURL: input.avatarURL,
    walletAddress: input.walletAddress,
  }, walletAddress);
  if (result.profile?.id) {
    setProfileId(result.profile.id);
  }
  return result.profile;
}

export async function addJoinedGroupId(groupId: string, profileId: string, walletAddress: string): Promise<void> {
  await apiRequest("PATCH", "/api/profiles", {
    joinedGroupIds: { $addToSet: groupId },
    profileId,
  }, walletAddress);
}

export async function addCreatedGroupId(groupId: string, profileId: string, walletAddress: string): Promise<void> {
  await apiRequest("PATCH", "/api/profiles", {
    createdGroupIds: { $addToSet: groupId },
    profileId,
  }, walletAddress);
}

export async function uploadProfileAvatar(profileId: string, file: Blob): Promise<string> {
  const storageRef = ref(storage, `users/${profileId}/avatar.jpg`);
  const snapshot = await uploadBytes(storageRef, file);
  const avatarURL = await getDownloadURL(snapshot.ref);
  await apiRequest("PATCH", "/api/profiles", { avatarURL, profileId }, "");
  return avatarURL;
}

export async function updateProfileDisplayName(displayName: string, profileId: string): Promise<void> {
  await apiRequest("PATCH", "/api/profiles", { displayName, profileId }, "");
}

export async function updateProfileWallet(walletAddress: string, profileId: string): Promise<void> {
  await apiRequest("PATCH", "/api/profiles", { walletAddress: walletAddress || "", profileId }, "");
}
