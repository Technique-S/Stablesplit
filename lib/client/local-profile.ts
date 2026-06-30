export function getProfileId(_walletAddress?: string): string {
  try {
    const cached = localStorage.getItem("stablesplit_profileId");
    if (cached) return cached;
  } catch {}
  return "";
}

export function setProfileId(uuid: string): void {
  try {
    localStorage.setItem("stablesplit_profileId", uuid);
  } catch {}
}
