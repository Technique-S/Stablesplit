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
    console.error("[apiRequest] Response failed", {
      path,
      method,
      status: res.status,
      statusText: res.statusText,
      walletAddress: headers["x-wallet-address"] ?? "NOT SET",
    });
    const text = await res.text().catch(() => "");
    console.error("[apiRequest] Response body", { text });
    let error: { message?: string } = { message: res.statusText };
    try { error = JSON.parse(text); } catch { error = { message: text || res.statusText }; }
    throw new Error(error.message || `API ${method} ${path} failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
