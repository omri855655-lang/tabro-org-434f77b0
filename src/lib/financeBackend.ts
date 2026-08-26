import { supabase } from "@/integrations/supabase/client";

const financeBackendUrl = import.meta.env.VITE_FINANCE_BACKEND_URL?.replace(/\/$/, "");
const financeBackendKey = import.meta.env.VITE_FINANCE_BACKEND_ANON_KEY;

export async function invokeFinanceBackend<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!financeBackendUrl || !financeBackendKey) {
    throw new Error("Finance backend is not configured");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Authentication required");

  const response = await fetch(`${financeBackendUrl}/functions/v1/finance-scraper-connect`, {
    method: "POST",
    headers: {
      apikey: financeBackendKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(body?.error || `Finance backend returned HTTP ${response.status}`);
  }
  return body as T;
}
