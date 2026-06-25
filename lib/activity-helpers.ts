import type { ActivityRecord } from "./types";

export function activityIcon(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.created") return "+";
  if (eventType === "expense.deleted") return "-";
  if (eventType === "wallet.linked" || eventType === "wallet.updated") return "W";
  if (eventType === "settlement.completed") return "✓";
  if (eventType === "invite.generated" || eventType === "member.joined_via_invite") return "🔗";
  if (eventType.startsWith("batch.")) return "B";
  if (eventType.startsWith("group.")) return "G";
  if (eventType.startsWith("member.")) return "M";
  if (eventType.startsWith("settlement.")) return "$";
  return "i";
}

export function activityIconLabel(eventType: ActivityRecord["eventType"]): string {
  return activityShortType(eventType);
}

export function activityIconBackground(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.deleted" || eventType === "settlement.failed" || eventType === "group.deleted" || eventType === "batch.settlement_failed") return "var(--red-light)";
  if (eventType === "settlement.completed" || eventType === "wallet.linked" || eventType === "member.joined_via_invite" || eventType === "batch.settlement_completed") return "var(--green-light)";
  if (eventType === "expense.created" || eventType === "wallet.updated" || eventType === "invite.generated" || eventType === "batch.settlement_initiated") return "var(--blue-light)";
  return "var(--surface-2)";
}

export function activityIconColor(eventType: ActivityRecord["eventType"]): string {
  if (eventType === "expense.deleted" || eventType === "settlement.failed" || eventType === "group.deleted" || eventType === "batch.settlement_failed") return "var(--red)";
  if (eventType === "settlement.completed" || eventType === "wallet.linked" || eventType === "member.joined_via_invite" || eventType === "batch.settlement_completed") return "var(--green)";
  if (eventType === "expense.created" || eventType === "wallet.updated" || eventType === "invite.generated" || eventType === "batch.settlement_initiated") return "var(--blue)";
  return "var(--text-2)";
}

export function activityShortType(eventType: ActivityRecord["eventType"]): string {
  return eventType.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace("_", " ")).join(" ");
}

export function formatActivityMetadata(metadata: Record<string, unknown>): string {
  const visibleEntries = Object.entries(metadata).filter(([, value]) => value !== "" && value !== undefined && value !== null);
  return visibleEntries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" · ");
}

export function shortenHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
