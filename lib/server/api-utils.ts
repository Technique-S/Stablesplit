import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "./firebase-admin";

type AuthResult = {
  uid: string;
  walletAddress: string;
};

export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const walletAddress = request.headers.get("x-wallet-address");
  if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
    const normalized = walletAddress.trim().toLowerCase();
    return { uid: normalized, walletAddress: normalized };
  }

  throw Object.assign(
    new Error("Authentication required. Provide x-wallet-address header."),
    { statusCode: 401 }
  );
}

export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ message }, { status });
}

export function okResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleError(error: unknown, context: string): NextResponse {
  const msg = error instanceof Error ? error.message : String(error);
  const status = (error as { statusCode?: number }).statusCode ?? 500;
  console.error(`[API:${context}]`, msg);
  return errorResponse(msg, status);
}

export function handleZodError(error: unknown): NextResponse | null {
  if (error instanceof z.ZodError) {
    return errorResponse(error.errors.map((e) => e.message).join("; "), 400);
  }
  return null;
}

export async function fetchGroupWithAuth(groupId: string): Promise<{
  ref: FirebaseFirestore.DocumentSnapshot;
  data: Record<string, unknown>;
  groupData: Record<string, unknown>;
  createdBy: string;
  memberAddresses: string[];
  members: Array<Record<string, unknown>>;
}> {
  const ref = await adminDb.collection("groups").doc(groupId).get();
  if (!ref.exists) {
    throw Object.assign(new Error("Group not found."), { statusCode: 404 });
  }
  const data = ref.data()!;
  const createdBy = String(data.createdBy ?? "").toLowerCase();
  const members: Array<Record<string, unknown>> = Array.isArray(data.members) ? data.members : [];
  const memberAddresses: string[] = Array.isArray(data.memberAddresses) ? data.memberAddresses : [];
  return { ref, data, groupData: data, createdBy, memberAddresses, members };
}

export function assertGroupMembership(
  groupData: Record<string, unknown>,
  authWallet: string
): void {
  const createdBy = String(groupData.createdBy ?? "").toLowerCase();
  const memberAddresses: string[] = Array.isArray(groupData.memberAddresses) ? groupData.memberAddresses : [];
  const members: Array<Record<string, unknown>> = Array.isArray(groupData.members) ? groupData.members : [];

  if (
    createdBy !== authWallet &&
    !memberAddresses.includes(authWallet) &&
    !members.some((m) => String(m.walletAddress ?? "").toLowerCase() === authWallet)
  ) {
    throw Object.assign(new Error("You are not a member of this group."), { statusCode: 403 });
  }
}

export function assertGroupOwner(
  groupData: Record<string, unknown>,
  authWallet: string
): void {
  const createdBy = String(groupData.createdBy ?? "").toLowerCase();
  if (createdBy !== authWallet) {
    throw Object.assign(new Error("Only the group owner can perform this action."), { statusCode: 403 });
  }
}

export async function parseBody<T>(request: NextRequest, schema: z.ZodSchema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}
