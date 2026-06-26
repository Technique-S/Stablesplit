import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { UserProfile } from "../types";
import { apiRequest } from "./api-client";
import { setProfileId } from "./local-profile";

export async function getProfileByWalletAddress(walletAddress: string): Promise<UserProfile | null> {
  if (!walletAddress) {
    console.warn("[ProfileGuard] getProfileByWalletAddress called with empty address");
    return null;
  }
  const addr = walletAddress.trim().toLowerCase();
  console.info("[ProfileGuard] walletLinks lookup for", addr);

  try {
    const result = await apiRequest<{ profile: UserProfile | null }>("GET", `/api/profiles`, undefined, addr);
    console.info("[ProfileGuard] API profile result:", result.profile ? "found profileId=" + result.profile.id : "not_found");
    if (result.profile) {
      setProfileId(result.profile.id);
    }
    return result.profile;
  } catch (err) {
    console.warn("[ProfileGuard] getProfileByWalletAddress error:", err);
    return null;
  }
}

export async function getProfile(profileId: string, walletAddress?: string): Promise<UserProfile | null> {
  if (!profileId) {
    console.warn("[ProfileGuard] getProfile called with empty profileId");
    return null;
  }
  try {
    const result = await apiRequest<{ profile: UserProfile | null }>("GET", `/api/profiles?id=${encodeURIComponent(profileId)}`, undefined, walletAddress);
    console.info("[ProfileGuard] getProfile API result:", result.profile ? "found user " + profileId : "not_found");
    return result.profile;
  } catch (err) {
    console.warn("[ProfileGuard] getProfile error:", err);
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


