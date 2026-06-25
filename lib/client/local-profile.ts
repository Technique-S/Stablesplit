export function getProfileId(_walletAddress?: string): string {
  try {
    const cached = sessionStorage.getItem("stablesplit_profileId");
    if (cached) return cached;
  } catch {}
  return "";
}

export function setProfileId(uuid: string): void {
  try {
    sessionStorage.setItem("stablesplit_profileId", uuid);
  } catch {}
}
