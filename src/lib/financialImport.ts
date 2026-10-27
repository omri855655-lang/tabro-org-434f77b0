import { supabase } from "@/integrations/supabase/client";
import type { ParsedTransaction } from "@/lib/financialProviders";

export const IMPORT_SOURCE_CONNECTION_ID = "00000000-0000-0000-0000-000000000000";

interface ImportParsedFinancialTransactionsParams {
  userId: string;
  parsed: ParsedTransaction[];
  provider: string;
  sourceType?: string;
  sourceConnectionId?: string;
  accountExternalId?: string;
  approvedBillingDateChanges?: BillingDateChange[];
}

export interface BillingDateChange {
  id: string;
  externalId: string;
  description: string;
  previousDate: string | null;
  nextDate: string;
}

const chunk = <T,>(items: T[], size: number) => {
  const groups: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }

  return groups;
};

const buildExternalId = (tx: ParsedTransaction, index: number, provider: string, sourceType: string) => {
  if (tx.external_transaction_id?.trim()) return tx.external_transaction_id.trim();

  return [
    sourceType,
    provider || "unknown",
    tx.transaction_date || "no-date",
    tx.posted_date || "no-posted-date",
    tx.description || tx.merchant || `row-${index + 1}`,
    tx.amount,
    tx.direction,
    tx.installment_number || 0,
    tx.installment_total || 0,
  ]
    .join("_")
    .replace(/\s+/g, " ")
    .trim();
};

function normalizeImportRows({
  userId,
  parsed,
  provider,
  sourceType = "csv",
  sourceConnectionId = IMPORT_SOURCE_CONNECTION_ID,
  accountExternalId,
}: ImportParsedFinancialTransactionsParams) {
  const occurrences = new Map<string, number>();
  const normalizedRows = parsed
    .map((tx, index) => {
      const baseId = buildExternalId(tx, index, provider, sourceType);
      const occurrence = (occurrences.get(baseId) || 0) + 1;
      occurrences.set(baseId, occurrence);
      const externalTransactionId = occurrence === 1 ? baseId : `${baseId}:${occurrence}`;

      return {
        user_id: userId,
        source_type: sourceType,
        source_connection_id: sourceConnectionId,
        provider: provider || null,
        external_transaction_id: externalTransactionId,
        transaction_date: tx.transaction_date,
        posted_date: tx.posted_date || null,
        amount: Math.abs(tx.amount),
        currency: tx.currency || "ILS",
        direction: tx.direction,
        description: tx.description?.trim() || tx.merchant?.trim() || externalTransactionId,
        merchant: tx.merchant?.trim() || null,
        category: tx.category || null,
        installment_total: tx.installment_total || null,
        installment_number: tx.installment_number || null,
        month_key: tx.transaction_date?.substring(0, 7) || null,
        raw_data: {
          ...(tx.raw_data || {}),
          ...(tx.billing_date ? { billing_date: tx.billing_date } : {}),
          ...(accountExternalId ? { account_external_id: accountExternalId } : {}),
        },
      };
    })
    .filter((tx) => tx.amount > 0 && tx.transaction_date && tx.description);

  const uniqueRows = Array.from(
    new Map(normalizedRows.map((row) => [row.external_transaction_id, row])).values(),
  );

  return { uniqueRows, skipped: normalizedRows.length - uniqueRows.length };
}

type StoredImportRow = { id: string; external_transaction_id: string; raw_data: Record<string, unknown> | null };
async function readExistingRows(input: ImportParsedFinancialTransactionsParams, externalIds: string[]) {
  const existing = new Map<string, StoredImportRow>();

  for (const idsChunk of chunk(externalIds, 200)) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("id, external_transaction_id, raw_data")
      .eq("user_id", input.userId)
      .eq("source_type", input.sourceType || "csv")
      .eq("source_connection_id", input.sourceConnectionId || IMPORT_SOURCE_CONNECTION_ID)
      .in("external_transaction_id", idsChunk);

    if (error) throw error;

    (data || []).forEach(row => {
      if (row.external_transaction_id) existing.set(row.external_transaction_id, { ...row, raw_data: row.raw_data && typeof row.raw_data === 'object' && !Array.isArray(row.raw_data) ? row.raw_data : null });
    });
    if (input.provider === "amex" && input.sourceType === "credit_card_import") {
      const { data: aliases, error: aliasError } = await supabase.from("financial_transactions")
        .select("id, external_transaction_id, raw_data").eq("user_id", input.userId)
        .eq("source_type", input.sourceType).eq("provider", "amex")
        .eq("source_connection_id", input.sourceConnectionId || IMPORT_SOURCE_CONNECTION_ID)
        .in("raw_data->>statement_canonical_id", idsChunk);
      if (aliasError) throw aliasError;
      for (const row of aliases || []) {
        const raw = row.raw_data && typeof row.raw_data === "object" && !Array.isArray(row.raw_data) ? row.raw_data : null;
        const canonical = raw?.statement_canonical_id;
        if (typeof canonical !== "string") continue;
        if (existing.has(canonical) && existing.get(canonical)!.id !== row.id) throw new Error("Ambiguous Amex import identity");
        existing.set(canonical, { ...row, raw_data: raw });
      }
    }
  }
  return existing;
}

export async function previewBillingDateChanges(input: ImportParsedFinancialTransactionsParams): Promise<BillingDateChange[]> {
  if (input.sourceType !== "credit_card_import" || input.provider !== "amex") return [];
  const { uniqueRows } = normalizeImportRows(input);
  const existing = await readExistingRows(input, uniqueRows.map(row => row.external_transaction_id));
  return uniqueRows.flatMap(row => {
    const old = existing.get(row.external_transaction_id);
    const previousDate = typeof old?.raw_data?.billing_date === "string" ? old.raw_data.billing_date : null;
    const nextDate = row.raw_data.billing_date;
    return old?.id && nextDate && nextDate !== previousDate
      ? [{ id: old.id, externalId: row.external_transaction_id, description: row.description, previousDate, nextDate }]
      : [];
  });
}

export async function importParsedFinancialTransactions(input: ImportParsedFinancialTransactionsParams) {
  const { uniqueRows, skipped: initialSkipped } = normalizeImportRows(input);
  let skipped = initialSkipped;
  const existing = await readExistingRows(input, uniqueRows.map(row => row.external_transaction_id));
  const rowsToInsert = uniqueRows.filter(row => !existing.has(row.external_transaction_id));
  skipped += uniqueRows.length - rowsToInsert.length;

  let updated = 0, conflicts = 0;
  if (input.provider === "amex" && input.sourceType === "credit_card_import") {
    const approved = new Map((input.approvedBillingDateChanges || []).map(change => [change.externalId, change]));
    for (const row of uniqueRows) {
      const approval = approved.get(row.external_transaction_id);
      const old = existing.get(row.external_transaction_id);
      if (!approval || !old) continue;
      const previousDate = typeof old.raw_data?.billing_date === "string" ? old.raw_data.billing_date : null;
      if (old.id !== approval.id || row.raw_data.billing_date !== approval.nextDate || previousDate !== approval.previousDate) {
        conflicts += 1; continue;
      }
      // Compare the complete metadata snapshot to avoid overwriting concurrent refund links or edits.
      let query = supabase.from("financial_transactions").update({ raw_data: { ...(old.raw_data || {}), billing_date: approval.nextDate } })
        .eq("id", old.id).eq("user_id", input.userId).eq("source_type", input.sourceType)
        .eq("source_connection_id", input.sourceConnectionId || IMPORT_SOURCE_CONNECTION_ID);
      query = old.raw_data === null ? query.is("raw_data", null) : query.eq("raw_data", JSON.stringify(old.raw_data));
      const { data, error } = await query.select("id");
      if (error) throw error;
      if (data?.length === 1) { updated += 1; skipped -= 1; } else conflicts += 1;
    }
  }

  let imported = 0;

  for (const rowsChunk of chunk(rowsToInsert, 100)) {
    const { error } = await supabase.from("financial_transactions").insert(rowsChunk);
    if (error) throw error;
    imported += rowsChunk.length;
  }

  return { imported, skipped, updated, conflicts };
}
