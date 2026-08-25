import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-connector-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDate(value: unknown) {
  const date = cleanText(value, 30).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function amount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function category(description: string) {
  const value = description.toLowerCase();
  const groups: Array<[string, string[]]> = [
    ["groceries", ["שופרסל", "רמי לוי", "יוחננוף", "סופר", "market"]],
    ["food", ["מסעד", "קפה", "ארומה", "פיצה", "restaurant"]],
    ["transport", ["רכבת", "אגד", "חניה", "פנגו", "gett", "uber"]],
    ["bills", ["חשמל", "ארנונה", "בזק", "סלקום", "פרטנר", "hot"]],
    ["shopping", ["amazon", "אמזון", "aliexpress", "zara", "קניון"]],
    ["health", ["סופר-פארם", "בית מרקחת", "מכבי", "כללית"]],
    ["entertainment", ["netflix", "spotify", "נטפליקס", "ספוטיפיי", "קולנוע"]],
  ];
  return groups.find(([, words]) => words.some((word) => value.includes(word)))?.[0] || null;
}

function batches<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    const body = await request.json();
    const action = cleanText(body.action, 50);
    const connectorToken = request.headers.get("x-connector-token");

    if (connectorToken) {
      const tokenHash = await sha256(connectorToken);
      const { data: device, error: deviceError } = await service
        .from("finance_connector_devices")
        .select("*")
        .eq("token_hash", tokenHash)
        .neq("status", "revoked")
        .maybeSingle();
      if (deviceError || !device) return json({ error: "Invalid or revoked connector token" }, 401);

      if (action === "heartbeat") {
        await service.from("finance_connector_devices").update({
          status: "online",
          platform: cleanText(body.platform, 80) || null,
          connector_version: cleanText(body.version, 30) || null,
          providers: Array.isArray(body.providers) ? body.providers.slice(0, 20) : [],
          last_seen_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", device.id);
        return json({ success: true, sync_interval_minutes: device.sync_interval_minutes });
      }

      if (action === "ingest") {
        const provider = cleanText(body.provider, 80);
        const providerName = cleanText(body.provider_name, 120) || provider;
        if (!provider) return json({ error: "provider is required" }, 400);
        const accountItems = Array.isArray(body.accounts) ? body.accounts.slice(0, 100) : [];
        const externalConnectionId = `${device.id}:${provider}`;

        let { data: connection } = await service.from("bank_connections").select("*")
          .eq("user_id", device.user_id)
          .eq("integration_provider", "local_scraper")
          .eq("external_connection_id", externalConnectionId)
          .maybeSingle();

        if (!connection) {
          const { data: created, error } = await service.from("bank_connections").insert({
            user_id: device.user_id,
            integration_provider: "local_scraper",
            external_connection_id: externalConnectionId,
            provider_name: providerName,
            status: "active",
            metadata: { connector_device_id: device.id, provider, read_only_behavior: true },
          }).select("*").single();
          if (error) throw error;
          connection = created;
        }

        const accountRows = accountItems.map((item: Record<string, unknown>, index: number) => {
          const externalId = cleanText(item.external_id, 180) || `${provider}:${index}`;
          return {
            user_id: device.user_id,
            connection_id: connection.id,
            external_account_id: externalId,
            provider_id: provider,
            provider_name: providerName,
            account_type: cleanText(item.account_type, 30).toUpperCase() || "CHECKING",
            display_name: cleanText(item.display_name, 120) || providerName,
            masked_number: cleanText(item.masked_number, 30) || null,
            currency: cleanText(item.currency, 3).toUpperCase() || "ILS",
            current_balance: Number.isFinite(Number(item.balance)) ? Number(item.balance) : null,
            raw_data: typeof item.raw_data === "object" && item.raw_data ? item.raw_data : {},
            last_synced_at: new Date().toISOString(),
          };
        });
        if (accountRows.length) {
          const { error } = await service.from("financial_accounts").upsert(accountRows, {
            onConflict: "user_id,connection_id,external_account_id",
          });
          if (error) throw error;
        }

        const transactionRows = accountItems.flatMap((item: Record<string, unknown>) => {
          const transactions = Array.isArray(item.transactions) ? item.transactions.slice(0, 10000) : [];
          return transactions.map((transaction: Record<string, unknown>, index: number) => {
            const transactionDate = cleanDate(transaction.date);
            const description = cleanText(transaction.description, 500) || "Imported transaction";
            return {
              user_id: device.user_id,
              source_type: "local_scraper",
              source_connection_id: connection.id,
              provider: providerName,
              external_transaction_id: cleanText(transaction.external_id, 240) || `${provider}:${transactionDate}:${index}`,
              transaction_date: transactionDate,
              posted_date: transaction.processed_date ? cleanDate(transaction.processed_date) : null,
              amount: amount(transaction.amount),
              currency: cleanText(transaction.currency, 3).toUpperCase() || "ILS",
              direction: transaction.direction === "income" ? "income" : "expense",
              description,
              merchant: cleanText(transaction.merchant, 300) || null,
              category: cleanText(transaction.category, 80) || category(description),
              installment_total: Number(transaction.installment_total) || null,
              installment_number: Number(transaction.installment_number) || null,
              month_key: transactionDate.slice(0, 7),
              raw_data: typeof transaction.raw_data === "object" && transaction.raw_data ? transaction.raw_data : {},
            };
          }).filter((row) => row.amount > 0);
        });

        const existingIds = new Set<string>();
        for (const ids of batches(transactionRows.map((row) => row.external_transaction_id), 200)) {
          const { data, error } = await service.from("financial_transactions").select("external_transaction_id")
            .eq("user_id", device.user_id)
            .eq("source_type", "local_scraper")
            .eq("source_connection_id", connection.id)
            .in("external_transaction_id", ids);
          if (error) throw error;
          for (const row of data || []) existingIds.add(row.external_transaction_id);
        }
        const rowsToInsert = transactionRows.filter((row) => !existingIds.has(row.external_transaction_id));
        for (const rows of batches(rowsToInsert, 250)) {
          const { error } = await service.from("financial_transactions").insert(rows);
          if (error) throw error;
        }

        const now = new Date().toISOString();
        await Promise.all([
          service.from("bank_connections").update({ status: "active", last_sync: now, last_error: null }).eq("id", connection.id),
          service.from("finance_connector_devices").update({ status: "online", last_seen_at: now, last_sync_at: now, last_error: null }).eq("id", device.id),
          service.from("financial_sync_logs").insert({
            user_id: device.user_id,
            connection_id: connection.id,
            provider: providerName,
            sync_finished_at: now,
            imported_count: rowsToInsert.length,
            status: "completed",
          }),
        ]);
        return json({ success: true, accounts_count: accountRows.length, transactions_count: rowsToInsert.length });
      }

      if (action === "report_error") {
        const message = cleanText(body.error, 1000) || "Connector error";
        await service.from("finance_connector_devices").update({
          status: "error",
          last_seen_at: new Date().toISOString(),
          last_error: message,
        }).eq("id", device.id);
        return json({ success: true });
      }

      return json({ error: "Unknown connector action" }, 400);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    if (action === "list_devices") {
      const { data, error } = await service.from("finance_connector_devices")
        .select("id,name,status,platform,connector_version,sync_interval_minutes,providers,last_seen_at,last_sync_at,last_error,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, devices: data || [] });
    }

    if (action === "create_pairing") {
      const deviceId = crypto.randomUUID();
      const secret = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
      const token = `tfc_${deviceId}.${secret}`;
      const interval = Math.min(10080, Math.max(30, Number(body.sync_interval_minutes) || 360));
      const { error } = await service.from("finance_connector_devices").insert({
        id: deviceId,
        user_id: user.id,
        name: cleanText(body.name, 100) || "My computer",
        token_hash: await sha256(token),
        sync_interval_minutes: interval,
      });
      if (error) throw error;
      return json({ success: true, device_id: deviceId, pairing_token: token });
    }

    if (action === "revoke_device" && body.device_id) {
      await service.from("finance_connector_devices").update({ status: "revoked", token_hash: await sha256(crypto.randomUUID()) })
        .eq("id", body.device_id).eq("user_id", user.id);
      await service.from("bank_connections").update({ status: "revoked" })
        .eq("user_id", user.id).eq("integration_provider", "local_scraper")
        .contains("metadata", { connector_device_id: body.device_id });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("finance-local-connector error", error);
    return json({ error: error instanceof Error ? error.message : "Connector request failed" }, 500);
  }
});
