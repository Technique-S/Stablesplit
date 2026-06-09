export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  walletAddress?: string
): Promise<T> {
  const headers: Record<string, string> = {};

  if (walletAddress) {
    headers["x-wallet-address"] = walletAddress.toLowerCase();
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API ${method} ${path} failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
