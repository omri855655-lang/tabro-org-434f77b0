import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ParsedTransaction } from "./financialProviders";
import type { AmexLegacyCorrection } from "./amexStatement";

type Stored = {
  id: string; external_transaction_id: string; amount: number; currency: string;
  installment_number: number | null; installment_total: number | null;
  raw_data: Record<string, unknown> | null;
};
export interface AmexRepairInput {
  userId: string; sourceConnectionId: string; parsed: ParsedTransaction[]; legacyCorrections: AmexLegacyCorrection[];
}
export interface AmexRepairDraft {
  id: string; description: string; before: Stored; pending: boolean;
  patch: { amount: number; currency: string; installment_number: number | null; installment_total: number | null; raw_data: Record<string, unknown> };
}

export async function previewAmexImportRepairs(input: AmexRepairInput): Promise<AmexRepairDraft[]> {
  if (!input.userId || !input.sourceConnectionId || !input.legacyCorrections.length) return [];
  const targets = new Map(input.parsed.map(row => [row.external_transaction_id, row]));
  if (targets.size !== input.parsed.length) throw new Error("Ambiguous Amex statement identities; manual review required");
  const candidates = input.legacyCorrections.filter(item => !item.next || targets.has(item.next.external_transaction_id));
  const ids = [...new Set(candidates.flatMap(item => [item.legacyExternalId, ...(item.next?.external_transaction_id ? [item.next.external_transaction_id] : [])]))];
  const stored = new Map<string, Stored>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from("financial_transactions")
      .select("id, external_transaction_id, amount, currency, installment_number, installment_total, raw_data")
      .eq("user_id", input.userId).eq("source_type", "credit_card_import").eq("provider", "amex")
      .eq("source_connection_id", input.sourceConnectionId).in("external_transaction_id", ids.slice(offset, offset + 200));
    if (error) throw error;
    for (const row of data || []) stored.set(row.external_transaction_id, row as Stored);
  }
  return candidates.flatMap(item => {
    const old = stored.get(item.legacyExternalId);
    if (!old) return [];
    const next = item.next ? targets.get(item.next.external_transaction_id) : null;
    if ((next && next.external_transaction_id === old.raw_data?.statement_canonical_id) || (!next && old.raw_data?.statement_excluded === true)) return [];
    const duplicate = next?.external_transaction_id && stored.get(next.external_transaction_id);
    if (duplicate && duplicate.id !== old.id) throw new Error("Conflicting Amex import identities; manual review required");
    const patch = next ? {
      amount: next.amount, currency: next.currency,
      installment_number: next.installment_number || null, installment_total: next.installment_total || null,
      raw_data: { ...(old.raw_data || {}), billing_date: next.billing_date || null, statement_canonical_id: next.external_transaction_id, statement_excluded: false },
    } : {
      amount: old.amount, currency: old.currency, installment_number: old.installment_number, installment_total: old.installment_total,
      raw_data: { ...(old.raw_data || {}), billing_date: null, statement_excluded: true, status: "pending", statement_exclusion_reason: "unsettled_amex_section" },
    };
    return [{ id: old.id, description: next?.description || item.legacyExternalId, before: old, pending: !next, patch }];
  });
}

export async function applyAmexImportRepairs(input: AmexRepairInput, approved: AmexRepairDraft[]) {
  const fresh = new Map((await previewAmexImportRepairs(input)).map(item => [item.id, item]));
  let updated = 0, conflicts = 0;
  for (const approval of approved) {
    const current = fresh.get(approval.id);
    if (!current || JSON.stringify(current) !== JSON.stringify(approval)) { conflicts++; continue; }
    const old = current.before;
    let query = supabase.from("financial_transactions").update({ ...current.patch, raw_data: current.patch.raw_data as Json })
      .eq("id", old.id).eq("user_id", input.userId).eq("source_type", "credit_card_import").eq("provider", "amex")
      .eq("source_connection_id", input.sourceConnectionId).eq("external_transaction_id", old.external_transaction_id)
      .eq("amount", old.amount).eq("currency", old.currency);
    query = old.raw_data === null ? query.is("raw_data", null) : query.eq("raw_data", JSON.stringify(old.raw_data));
    query = old.installment_number === null ? query.is("installment_number", null) : query.eq("installment_number", old.installment_number);
    query = old.installment_total === null ? query.is("installment_total", null) : query.eq("installment_total", old.installment_total);
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (data?.length === 1) updated++; else conflicts++;
  }
  return { updated, conflicts };
}
