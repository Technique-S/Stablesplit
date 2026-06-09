import { NextRequest, NextResponse } from "next/server";

export type AuthResult = {
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
