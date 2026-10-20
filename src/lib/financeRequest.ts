export async function withFinanceReadTimeout<T>(request: PromiseLike<T>, timeoutMs = 25_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("FINANCE_READ_TIMEOUT")), timeoutMs);
  });
  try { return await Promise.race([Promise.resolve(request), timeout]); }
  finally { clearTimeout(timer!); }
}

export function assertFinanceListResponse(value: unknown): asserts value is { accounts: unknown[]; transactions: unknown[]; connections: unknown[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_FINANCE_RESPONSE");
  const data = value as Record<string, unknown>;
  if (!["accounts", "transactions", "connections"].every(key => Array.isArray(data[key])
    && (data[key] as unknown[]).every(item => item !== null && typeof item === "object" && !Array.isArray(item)))) {
    throw new Error("INVALID_FINANCE_RESPONSE");
  }
}
