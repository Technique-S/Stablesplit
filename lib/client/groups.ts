import { apiRequest } from "./api-client";
import { Group } from "../types";
import { normalizeMembers, memberWalletMap } from "../domain/members";
import { toMillis } from "../timestamp";

export async function getGroup(id: string): Promise<Group> {
  const data = await apiRequest<Record<string, unknown>>(
    "GET",
    `/api/groups/${encodeURIComponent(id)}`
  );

  const createdAt = toMillis(data.createdAt);
  const members = normalizeMembers(
    data.members as Array<Record<string, unknown>>,
    (data.memberWallets as Record<string, string>) ?? {},
    createdAt
  );
  return {
    id: data.id as string,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    members,
    memberWallets: {
      ...((data.memberWallets as Record<string, string>) ?? {}),
      ...memberWalletMap(members),
    },
    currency: (data.currency as string) ?? "USD",
    createdAt,
    firstSettlementAt: data.firstSettlementAt
      ? toMillis(data.firstSettlementAt)
      : undefined,
    isDemo: (data.isDemo as boolean) ?? false,
    inviteCode: data.inviteCode as string | undefined,
    photoURL: data.photoURL as string | undefined,
    templateType: data.templateType as string | undefined,
    createdBy: data.createdBy as string | undefined,
  } as Group;
}

export async function getGroups(walletAddress: string): Promise<Group[]> {
  const data = await apiRequest<{ groups: Array<Record<string, unknown>> }>(
    "GET",
    "/api/groups",
    undefined,
    walletAddress
  );

  const groups = (data.groups ?? []).map((g) => {
    const createdAt = toMillis(g.createdAt);
    const members = normalizeMembers(
      g.members as Array<Record<string, unknown>>,
      (g.memberWallets as Record<string, string>) ?? {},
      createdAt
    );
    return {
      id: g.id as string,
      name: (g.name as string) ?? "",
      description: (g.description as string) ?? "",
      members,
      memberWallets: {
        ...((g.memberWallets as Record<string, string>) ?? {}),
        ...memberWalletMap(members),
      },
      currency: (g.currency as string) ?? "USD",
      createdAt,
      firstSettlementAt: g.firstSettlementAt
        ? toMillis(g.firstSettlementAt)
        : undefined,
      isDemo: (g.isDemo as boolean) ?? false,
      inviteCode: g.inviteCode as string | undefined,
      photoURL: g.photoURL as string | undefined,
      templateType: g.templateType as string | undefined,
      createdBy: g.createdBy as string | undefined,
    } as Group;
  });

  return groups.sort((a, b) => b.createdAt - a.createdAt);
}
