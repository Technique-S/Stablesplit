import { NextRequest } from "next/server";
import { verifyAuth, okResponse, errorResponse, handleError } from "@/lib/server/api-utils";

const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { EUR: 0.92, GBP: 0.79, NGN: 1550, JPY: 149.5, CAD: 1.36, AUD: 1.53, INR: 83.1 },
  EUR: { USD: 1.09, GBP: 0.86, NGN: 1685, JPY: 162.5, CAD: 1.48, AUD: 1.66, INR: 90.3 },
};

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const base = (searchParams.get("base") ?? "USD").toUpperCase();
    const target = (searchParams.get("target") ?? "").toUpperCase();

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (apiKey) {
      try {
        const url = target
          ? `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${base}/${target}`
          : `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (data.result === "success") {
            return okResponse(target
              ? { base, target, rate: data.conversion_rate }
              : { base, rates: data.conversion_rates }
            );
          }
        }
      } catch {
        // fall through to fallback
      }
    }

    if (target) {
      const rate = FALLBACK_RATES[base]?.[target];
      if (!rate) {
        return errorResponse(`Unsupported currency pair: ${base}/${target}`, 400);
      }
      return okResponse({ base, target, rate });
    }

    return okResponse({ base, rates: FALLBACK_RATES[base] ?? {} });
  } catch (error) {
    return handleError(error, "rates.GET");
  }
}
