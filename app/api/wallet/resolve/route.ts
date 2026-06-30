import { NextRequest } from "next/server";
import { okResponse, errorResponse } from "@/lib/server/api-utils";
import { resolveProfileName } from "@/lib/server/firebase-admin";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return errorResponse("Missing address parameter", 400);

  const resolved = await resolveProfileName(address);
  if (!resolved) return okResponse({ found: false });

  return okResponse({ found: true, displayName: resolved.displayName, profileId: resolved.profileId });
}
