import { supabase } from "@/integrations/supabase/client";
import type { ParsedTransaction } from "@/lib/financialProviders";

export const IMPORT_SOURCE_CONNECTION_ID = "00000000-0000-0000-0000-000000000000";

interface ImportParsedFinancialTransactionsParams {
  userId: string;
  parsed: ParsedTransaction[];
  provider: string;
  sourceType?: string;
  sourceConnectionId?: string;
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

export async function importParsedFinancialTransactions({
  userId,
  parsed,
  provider,
  sourceType = "csv",
  sourceConnectionId = IMPORT_SOURCE_CONNECTION_ID,
}: ImportParsedFinancialTransactionsParams) {
  const normalizedRows = parsed
    .map((tx, index) => {
      const externalTransactionId = buildExternalId(tx, index, provider, sourceType);

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
        raw_data: tx.raw_data || null,
      };
    })
    .filter((tx) => tx.amount > 0 && tx.transaction_date && tx.description);

  const uniqueRows = Array.from(
    new Map(normalizedRows.map((row) => [row.external_transaction_id, row])).values(),
  );

  let skipped = normalizedRows.length - uniqueRows.length;
  const existingExternalIds = new Set<string>();

  for (const idsChunk of chunk(uniqueRows.map((row) => row.external_transaction_id), 200)) {
    const { data, error } = await supabase
      .from("financial_transactions" as any)
      .select("external_transaction_id")
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_connection_id", sourceConnectionId)
      .in("external_transaction_id", idsChunk);

    if (error) throw error;

    (data || []).forEach((row: any) => {
      if (row.external_transaction_id) existingExternalIds.add(row.external_transaction_id);
    });
  }

  const rowsToInsert = uniqueRows.filter((row) => !existingExternalIds.has(row.external_transaction_id));
  skipped += uniqueRows.length - rowsToInsert.length;

  let imported = 0;

  for (const rowsChunk of chunk(rowsToInsert, 100)) {
    const { error } = await supabase.from("financial_transactions" as any).insert(rowsChunk as any);
    if (error) throw error;
    imported += rowsChunk.length;
  }

  return { imported, skipped };
}