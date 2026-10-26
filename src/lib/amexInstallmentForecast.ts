import { parseFinancialDate } from './financialProviders.ts';

export interface InstallmentEvidence {
  id: string;
  external_transaction_id?: string | null;
  source_type: string;
  source_connection_id?: string | null;
  provider?: string | null;
  description?: string | null;
  amount: number;
  currency?: string | null;
  direction: string;
  installment_number?: number | null;
  installment_total?: number | null;
  hidden?: boolean;
  raw_data?: { billing_date?: string | null; status?: string | null } | null;
}
export interface InstallmentEstimate { key: string; date: string; amount: number; currency: string; description: string; installment: number; total: number }

function monthOffset(date: string, offset: number) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Separate estimates only; never create transactions or add them to reported totals. */
export function forecastAmexInstallments(rows: readonly InstallmentEvidence[], from: string, through: string): InstallmentEstimate[] {
  if (!parseFinancialDate(from) || !parseFinancialDate(through) || through < from) return [];
  const groups = new Map<string, { rows: InstallmentEvidence[]; blocked: boolean }>();
  for (const row of rows) {
    if (row.source_type !== 'credit_card_import' || row.provider !== 'amex' || !row.source_connection_id) continue;
    const external = row.external_transaction_id || '';
    if (!external.startsWith('amex-csv-v1:')) continue;
    let identity: unknown;
    try { identity = JSON.parse(external.slice('amex-csv-v1:'.length).replace(/:\d+$/, '')); } catch { continue; }
    if (!Array.isArray(identity) || identity.length !== 6 || typeof identity[0] !== 'string' || !identity[0]) continue;
    // Without an issuer reference a similar merchant/amount can be a separate purchase.
    // Do not project ambiguous matches or repeated occurrences.
    if (identity[0].includes('|')) continue;
    const key = JSON.stringify([row.source_connection_id, identity[0], identity[1], identity[3]]);
    const group = groups.get(key) || { rows: [], blocked: false };
    group.blocked ||= !!row.hidden || row.direction !== 'expense' || /:\d+$/.test(external) || /cancelled|canceled|void|בוטל/i.test(row.raw_data?.status || '');
    group.rows.push(row);
    groups.set(key, group);
  }
  const result: InstallmentEstimate[] = [];
  for (const [key, group] of groups) {
    if (group.blocked) continue;
    const valid = group.rows.filter(row => Number.isInteger(row.installment_number) && Number.isInteger(row.installment_total)
      && row.installment_number! > 0 && row.installment_number! <= row.installment_total! && row.installment_total! <= 600
      && row.raw_data?.billing_date && parseFinancialDate(row.raw_data.billing_date) === row.raw_data.billing_date
      && Number.isFinite(row.amount) && row.amount > 0 && /^[A-Z]{3}$/.test(row.currency || ''));
    // Missing, conflicting, or repeated evidence cannot safely establish a schedule.
    if (valid.length !== group.rows.length || new Set(valid.map(row => row.installment_number)).size !== valid.length
      || new Set(valid.map(row => row.installment_total)).size !== 1 || new Set(valid.map(row => row.currency)).size !== 1) continue;
    const latest = [...valid].sort((a,b) => b.installment_number! - a.installment_number!)[0];
    if (!latest) continue;
    const base = latest.raw_data!.billing_date!;
    for (let installment = latest.installment_number! + 1; installment <= latest.installment_total!; installment++) {
      const date = monthOffset(base, installment - latest.installment_number!);
      if (date > through) break;
      if (date < from) continue;
      result.push({ key: `${key}:${installment}`, date, amount: latest.amount, currency: latest.currency!, description: latest.description || 'American Express', installment, total: latest.installment_total! });
    }
  }
  return result.sort((a,b) => a.date.localeCompare(b.date));
}
