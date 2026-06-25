import { isAddress } from "viem";
import { Member } from "./types";

export type MemberRecord = Partial<Member> | string;

const AVATAR_COLORS = [
  "var(--avatar-1)",
  "var(--avatar-2)",
  "var(--avatar-3)",
  "var(--avatar-4)",
  "var(--avatar-5)",
  "var(--avatar-6)",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueId(prefix = "member"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getAvatarColor(seed: string): string {
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length];
}

export function memberInitials(memberOrName: Member | string): string {
  const displayName = typeof memberOrName === "string" ? memberOrName : memberOrName.displayName;
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function createMember(
  displayName: string,
  walletAddress = "",
  avatarColor?: string,
  createdAt = Date.now()
): Member {
  const name = displayName.trim();
  return {
    id: uniqueId("member"),
    displayName: name,
    walletAddress: walletAddress.trim() || undefined,
    avatarColor: avatarColor || getAvatarColor(name),
    createdAt,
  };
}

function normalizeWalletAddress(wallet: unknown): string | undefined {
  if (typeof wallet !== "string") return undefined;
  const trimmed = wallet.trim();
  return trimmed || undefined;
}

export function validateEvmAddress(address: string): boolean {
  return isAddress(address.trim());
}

export function shortenAddress(address?: string): string {
  if (!address) return "";
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function normalizeMembers(
  rawMembers: unknown,
  legacyWallets: Record<string, string> = {},
  fallbackCreatedAt = Date.now()
): Member[] {
  const records = Array.isArray(rawMembers) ? rawMembers : [];
  const usedIds = new Set<string>();

  return records
    .map((record): Member | null => {
      if (typeof record === "string") {
        const displayName = record.trim();
        if (!displayName) return null;
        const walletAddress = normalizeWalletAddress(legacyWallets[displayName]);
        const id = `legacy-${slugify(displayName) || "member"}-${hashString(displayName)}`;
        return {
          id,
          displayName,
          walletAddress,
          avatarColor: getAvatarColor(displayName),
          createdAt: fallbackCreatedAt,
        };
      }

      if (!record || typeof record !== "object") return null;
      const value = record as Partial<Member> & { name?: unknown; wallet?: unknown };
      const displayName = String(value.displayName ?? value.name ?? "").trim();
      if (!displayName) return null;

      const legacyWallet = legacyWallets[displayName] ?? (value.id ? legacyWallets[value.id] : undefined);
      const walletAddress = normalizeWalletAddress(value.walletAddress ?? value.wallet ?? legacyWallet);
      const seededId = `legacy-${slugify(displayName) || "member"}-${hashString(displayName)}`;
      return {
        id: String(value.id ?? seededId),
        displayName,
        walletAddress,
        avatarColor: value.avatarColor || getAvatarColor(displayName),
        createdAt: typeof value.createdAt === "number" ? value.createdAt : fallbackCreatedAt,
        profileId: value.profileId || undefined,
        role: (value.role === "owner" || value.role === "member" ? value.role : undefined) as "owner" | "member" | undefined,
      };
    })
    .filter((member): member is Member => Boolean(member))
    .map((member) => {
      if (!usedIds.has(member.id)) {
        usedIds.add(member.id);
        return member;
      }

      const id = `${member.id}-${usedIds.size}`;
      usedIds.add(id);
      return { ...member, id };
    });
}

export function memberNames(members: Member[]): string[] {
  return members.map((member) => member.displayName);
}

export function memberWalletMap(members: Member[]): Record<string, string> {
  return Object.fromEntries(
    members
      .filter((member) => member.walletAddress)
      .flatMap((member) => [
        [member.displayName, member.walletAddress],
        [member.id, member.walletAddress],
      ])
  ) as Record<string, string>;
}

function findMember(members: Member[], idOrName: string): Member | undefined {
  return members.find(
    (member) => member.id === idOrName || member.displayName.toLowerCase() === idOrName.toLowerCase()
  );
}

export function getMemberWallet(members: Member[], idOrName: string): string {
  return findMember(members, idOrName)?.walletAddress?.trim() ?? "";
}

export function extractMemberAddresses(members: Member[]): string[] {
  return [
    ...new Set(
      members
        .map((m) => m.walletAddress?.toLowerCase())
        .filter((w): w is string => Boolean(w))
    ),
  ];
}
