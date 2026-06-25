const API_KEY = "b7a2ecf71c18a8bb2fe29039";
const BASE_URL = "https://v6.exchangerate-api.com/v6";
const CACHE_KEY = "stablesplit_fx_rates";
const CACHE_DURATION = 6 * 60 * 60 * 1000;

interface RateCache {
  timestamp: number;
  rates: Record<string, number>;
}

function isExpired(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;
    const cached: RateCache = JSON.parse(raw);
    return Date.now() - cached.timestamp > CACHE_DURATION;
  } catch {
    return true;
  }
}

function getFromCache(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: RateCache = JSON.parse(raw);
    return cached.rates;
  } catch {
    return null;
  }
}

function saveToCache(rates: Record<string, number>): void {
  try {
    const cache: RateCache = { timestamp: Date.now(), rates };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

async function fetchRates(): Promise<Record<string, number>> {
  const resp = await fetch(`${BASE_URL}/${API_KEY}/latest/USD`);
  if (!resp.ok) throw new Error(`Exchange rate API error: ${resp.status}`);
  const data = await resp.json();
  if (data.result !== "success") throw new Error(`Exchange rate API: ${data["error-type"] ?? "unknown error"}`);
  const rates = data.conversion_rates as Record<string, number>;
  saveToCache(rates);
  return rates;
}

export async function getRates(): Promise<Record<string, number>> {
  if (!isExpired()) {
    const cached = getFromCache();
    if (cached) return cached;
  }
  return fetchRates();
}

export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) throw new Error(`Unsupported currency: ${from} or ${to}`);
  const inUsd = from === "USD" ? amount : amount / fromRate;
  return to === "USD" ? inUsd : inUsd * toRate;
}
