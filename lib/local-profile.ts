export function getProfileId(walletAddress?: string): string {
  if (!walletAddress || typeof walletAddress !== "string") return "";
  const trimmed = walletAddress.trim().toLowerCase();
  if (!trimmed.startsWith("0x") || trimmed.length < 10) return "";
  return trimmed;
}