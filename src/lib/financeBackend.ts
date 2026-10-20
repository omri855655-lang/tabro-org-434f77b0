import { supabase } from "@/integrations/supabase/client";
import { assertFinanceListResponse, withFinanceReadTimeout } from "@/lib/financeRequest";

const financeBackendUrl = import.meta.env.VITE_FINANCE_BACKEND_URL?.replace(/\/$/, "");
const financeBackendKey = import.meta.env.VITE_FINANCE_BACKEND_ANON_KEY;

export const financeBackendOrigin = (() => {
  try {
    return financeBackendUrl ? new URL(financeBackendUrl).origin : null;
  } catch {
    return null;
  }
})();

export async function invokeFinanceFunction<T = unknown>(
  functionName: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!financeBackendUrl || !financeBackendKey) {
    throw new Error("Finance backend is not configured");
  }

  const { data: { session } } = await withFinanceReadTimeout(supabase.auth.getSession(), 15_000);
  if (!session?.access_token) throw new Error("Authentication required");

  const response = await fetch(`${financeBackendUrl}/functions/v1/${functionName}`, {
    method: "POST",
    signal: AbortSignal.timeout(["list", "providers", "worker_status"].includes(String(payload.action)) ? 25_000 : 90_000),
    headers: {
      apikey: financeBackendKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => { throw new Error("INVALID_FINANCE_RESPONSE"); });
  if (!response.ok || body?.error) {
    throw new Error(body?.error || `Finance backend returned HTTP ${response.status}`);
  }
  return body as T;
}

export async function invokeFinanceBackend<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const result = await invokeFinanceFunction<T>("finance-scraper-connect", { action, ...payload });
  if (action === "list") assertFinanceListResponse(result);
  return result;
}
