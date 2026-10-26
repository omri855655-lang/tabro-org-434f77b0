import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import XLSX from 'xlsx';
import { parseCSV } from '../src/lib/financialProviders.ts';
import { findStatementTable, statementBillingDate } from '../src/lib/cardStatement.ts';
import { parseAmexStatement, reconcileAmexStatement, summarizeAmexStatement } from '../src/lib/amexStatement.ts';

const file = process.argv[2];
if (!file) throw new Error('Usage: node --experimental-strip-types scripts/audit-amex-workbook.mjs <statement.xlsx>');
// Read-only local audit: no network, transaction writes, merchant names, or card identifiers.
const workbook = XLSX.read(readFileSync(file));
const result = workbook.SheetNames.map(name => {
  const table = findStatementTable(parseCSV(XLSX.utils.sheet_to_csv(workbook.Sheets[name])));
  const parsed = parseAmexStatement(table.rows, table.headers);
  return {
    sheet: name, recognized: !parsed.unsupported, transactions: parsed.transactions.length,
    skippedRows: parsed.skipped, billingDate: statementBillingDate(table.preamble, parsed.transactions, basename(file)) || null,
    installmentTransactions: parsed.transactions.filter(row => row.installment_total).length,
    totals: summarizeAmexStatement(parsed.transactions), reconciliation: reconcileAmexStatement(table.rows, table.headers, parsed.transactions),
  };
});
console.log(JSON.stringify(result, null, 2));
