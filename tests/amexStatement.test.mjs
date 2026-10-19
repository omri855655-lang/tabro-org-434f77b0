import assert from "node:assert/strict";
import test from "node:test";
import { parseAmexAmount, parseAmexStatement, summarizeAmexStatement, decodeStatementText, AMEX_CSV_TEMPLATE } from "../src/lib/amexStatement.ts";
import { parseCSV, detectProvider } from "../src/lib/financialProviders.ts";
import { findStatementTable, applyStatementBillingDate, sanitizeStatementRows, selectCardRows, futureStatementCharges } from "../src/lib/cardStatement.ts";

const headers = ["תאריך עסקה", "שם בית העסק", "סכום עסקה", "מטבע עסקה", 'סכום חיוב בש"ח', "מספר כרטיס", "תאריך חיוב", "תשלומים", "סוג עסקה", "סטטוס"];
const parse = (rows) => parseAmexStatement(rows, headers);

test("Amex prefers billed ILS, keeps installment metadata and categorizes using shared rules", () => {
  const { transactions, skipped } = parse([["01/10/2026", "Amazon", "30", "USD", "112.50", "123456789011234", "02/11/2026", "2 מתוך 3", "", ""]]);
  assert.equal(skipped, 0);
  const [row] = transactions;
  assert.equal(row.amount, 112.5);
  assert.equal(row.currency, "ILS");
  assert.equal(row.category, "קניות");
  assert.equal(row.installment_number, 2);
  assert.equal(row.installment_total, 3);
  assert.equal(row.billing_date, "2026-11-02");
  assert.equal(row.raw_data["card ending"], "1234");
  assert.ok(!JSON.stringify(row).includes("123456789011234"));
});

test("foreign original amount stays USD when the ILS billing cell is empty", () => {
  const { transactions } = parse([["01/10/2026", "Amazon", "30", "USD", "", "1234", "", "", "", ""]]);
  assert.equal(transactions[0].amount, 30);
  assert.equal(transactions[0].currency, "USD");
});

test("credits reduce confirmed statement charges without inventing future installments", () => {
  const { transactions } = parse([
    ["01/10/2026", "שופרסל", "", "", "100", "1234", "", "1/3", "", ""],
    ["02/10/2026", "שופרסל", "", "", "(20)", "1234", "", "", "", ""],
    ["03/10/2026", "שופרסל", "", "", "5", "1234", "", "", "זיכוי", ""],
  ]);
  assert.deepEqual(transactions.map((row) => row.direction), ["expense", "income", "income"]);
  assert.deepEqual(summarizeAmexStatement(transactions), [{ currency: "ILS", expenses: 100, credits: 25, net: 75 }]);
  const imported = sanitizeStatementRows(applyStatementBillingDate(transactions, "2026-11-02")).map((row) => ({
    ...row, source_type: "credit_card_import", source_connection_id: "amex-a",
    raw_data: { ...row.raw_data, billing_date: row.billing_date },
  }));
  assert.deepEqual(futureStatementCharges(imported, "csv-card:amex-a", "2026-10-19", "2027-01-19"), [{ billingDate: "2026-11-02", amount: 75 }]);
  assert.deepEqual(futureStatementCharges(imported, "csv-card:other", "2026-10-19", "2027-01-19"), []);
});

test("refund-only statements do not create negative future expenses", () => {
  const [row] = parse([["01/10/2026", "Refund", "", "", "-20", "1234", "02/11/2026"]]).transactions;
  assert.deepEqual(futureStatementCharges([{ ...row, source_type: "credit_card_import", source_connection_id: "a", raw_data: { ...row.raw_data, billing_date: row.billing_date } }], "csv-card:a", "2026-10-19", "2027-01-19"), []);
});

test("separate currencies are never added into a shekel total", () => {
  const { transactions } = parse([
    ["01/10/2026", "שופרסל", "", "", "100", "1234"],
    ["02/10/2026", "Netflix", "12.50", "USD", "", "1234"],
  ]);
  assert.deepEqual(summarizeAmexStatement(transactions).map(({ currency, net }) => [currency, net]), [["ILS", 100], ["USD", 12.5]]);
});

test("invalid dates, unknown currencies, cancellations, totals and malformed amounts are reported as skipped", () => {
  const { transactions, skipped } = parse([
    ["31/02/2026", "shop", "", "", "100"],
    ["01/10/2026", "shop", "20", "", ""],
    ["01/10/2026", "shop", "", "", "bad"],
    ["01/10/2026", "shop", "", "", "100", "", "", "", "", "cancelled"],
    ["", 'סה"כ', "", "", "100"],
  ]);
  assert.equal(transactions.length, 0);
  assert.equal(skipped, 5);
  assert.equal(parseAmexStatement([["1", "2"]], ["foo", "bar"]).unsupported, true);
});

test("amount parsing preserves signs and rejects ambiguous decimal commas", () => {
  for (const [value, expected] of [["1,234.50", 1234.5], ["(20.00)", -20], ["20-", -20], ["12,50", null], ["12abc", null], ["", null]]) {
    assert.equal(parseAmexAmount(value), expected);
  }
});

test("English headings, separate installment columns, category overrides and per-row due dates work", () => {
  const result = parseAmexStatement([["2026-10-01", "Shop", "10", "EUR", "2026-11-04", "2", "4", "My category"]],
    ["Date", "Description", "Amount", "Currency", "Due Date", "Installment Number", "Total Installments", "Category"]);
  const [row] = result.transactions;
  assert.equal(row.category, "My category");
  assert.equal(row.installment_number, 2);
  assert.equal(row.installment_total, 4);
  assert.equal(applyStatementBillingDate([row], "2026-12-02")[0].billing_date, "2026-11-04");
});

test("identity is stable across reorders but separates currencies and installment numbers", () => {
  const rows = [
    ["01/10/2026", "Shop", "10", "USD", "", "1234", "", "1/3"],
    ["01/10/2026", "Shop", "10", "EUR", "", "1234", "", "1/3"],
    ["01/10/2026", "Shop", "10", "USD", "", "1234", "", "2/3"],
  ];
  const ids = parse(rows).transactions.map((row) => row.external_transaction_id);
  assert.equal(new Set(ids).size, 3);
  assert.deepEqual(parse(rows.toReversed()).transactions.map((row) => row.external_transaction_id).sort(), ids.sort());
});

test("other cards are excluded and unknown card identity needs explicit confirmation", () => {
  const { transactions } = parse([
    ["01/10/2026", "A", "", "", "1", "1234"],
    ["01/10/2026", "B", "", "", "2", "5678"],
    ["01/10/2026", "C", "", "", "3", ""],
  ]);
  const selection = selectCardRows(transactions, "1234");
  assert.equal(selection.matching.length, 1);
  assert.equal(selection.unidentified.length, 1);
  assert.equal(selection.excluded, 1);
});

test("CSV title preambles no longer break delimiter detection and MAX/CAL retain their parsers", () => {
  const table = findStatementTable(parseCSV('American Express\nתאריך עסקה;שם בית העסק;סכום חיוב בש"ח\n01/10/2026;Shop;100'));
  assert.equal(parseAmexStatement(table.rows, table.headers).transactions.length, 1);
  for (const [date, id] of [["תאריך רכישה", "max"], ["תאריך העסקה", "cal"]]) {
    assert.equal(detectProvider([date, "שם בית עסק", "סכום חיוב"], []).id, id);
  }
});

test("decoding supports legacy Hebrew and blank templates contain no sample financial transactions", () => {
  assert.equal(decodeStatementText(new Uint8Array([0xf9, 0xec, 0xe5, 0xed]).buffer), "שלום");
  const text = "תאריך,amount";
  assert.equal(decodeStatementText(new TextEncoder().encode(text).buffer), text);
  assert.equal(AMEX_CSV_TEMPLATE.trim().split(/\r?\n/).length, 1);
});
