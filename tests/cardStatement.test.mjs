import assert from "node:assert/strict";
import test from "node:test";
import { detectProvider, financialProviders, parseCSV, parseFinancialDate } from "../src/lib/financialProviders.ts";
import { cardLastFour, futureStatementCharges, nextCsvBillingEstimateDate, sanitizeStatementRows, selectCardRows, statementRows } from "../src/lib/cardStatement.ts";

test("CSV parser preserves quoted commas, escaped quotes and multiline descriptions", () => {
  const { headers, rows } = parseCSV('\uFEFFתאריך עסקה,שם בית העסק,סכום\r\n16/09/2026,"חנות, ""במרכז""\nתל אביב","1,234.50"\r\n');
  assert.deepEqual(headers, ["תאריך עסקה", "שם בית העסק", "סכום"]);
  assert.deepEqual(rows, [["16/09/2026", 'חנות, "במרכז"\nתל אביב', "1,234.50"]]);
});

test("CSV parser detects semicolons despite quoted commas", () => {
  const { headers, rows } = parseCSV('date;"description, name";amount\n2026-09-16;"shop, city";42');
  assert.deepEqual(headers, ["date", "description, name", "amount"]);
  assert.deepEqual(rows, [["2026-09-16", "shop, city", "42"]]);
});

test("invalid dates are rejected instead of silently becoming today", () => {
  assert.equal(parseFinancialDate("31/02/2026"), "");
  assert.equal(parseFinancialDate("2026-02-31"), "");
  assert.equal(parseFinancialDate("16/09/2026"), "2026-09-16");
});

test("statement rows keep only expenses and retain explicit billing dates", () => {
  const parsed = [
    { transaction_date: "2026-09-16", amount: 90, direction: "expense", description: "shop", raw_data: { "תאריך עסקה": "16/09/2026", "תאריך חיוב": "10/10/2026", "מספר כרטיס": "****1234" } },
    { transaction_date: "2026-09-16", amount: 20, direction: "expense", description: "refund", raw_data: { "סוג עסקה": "זיכוי" } },
    { transaction_date: "2026-09-16", amount: 10, direction: "expense", description: "void", raw_data: { status: "cancelled" } },
    { transaction_date: "2026-09-16", amount: 10, direction: "income", description: "income" },
    { transaction_date: "2026-09-16", amount: 10, direction: "expense", description: "bad date", raw_data: { "תאריך עסקה": "31/02/2026" } },
  ];
  const rows = statementRows(parsed);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].billing_date, "2026-10-10");
  assert.equal(cardLastFour(rows[0].raw_data), "1234");
});

test("card parser prefers the ILS billed amount over foreign transaction amount", () => {
  const headers = ["תאריך עסקה", "שם בית העסק", "סכום עסקה", "מטבע עסקה", "סכום חיוב בש\"ח"];
  const rows = [["16/09/2026", "foreign shop", "30", "USD", "112.50"]];
  const parsed = statementRows(detectProvider(headers, rows).parse(rows, headers));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].amount, 112.5);
  assert.equal(parsed[0].currency, "ILS");
});

test("foreign amounts without an ILS billed amount are not imported as shekels", () => {
  const rows = statementRows([{ transaction_date: "2026-09-16", amount: 30, currency: "USD", direction: "expense", description: "foreign shop" }]);
  assert.equal(rows.length, 0);
});

test("CAL and MAX use an explicit ILS bill rather than the foreign transaction amount", () => {
  for (const [dateHeader, providerId] of [["תאריך העסקה", "cal"], ["תאריך רכישה", "max"]]) {
    const headers = [dateHeader, "שם בית עסק", "סכום עסקה", "מטבע עסקה", "סכום חיוב בש״ח"];
    const rows = [["16/09/2026", "foreign shop", "30", "USD", "112.50"]];
    const provider = detectProvider(headers, rows);
    assert.equal(provider.id, providerId);
    assert.equal(statementRows(provider.parse(rows, headers))[0].amount, 112.5);

    const withoutBillHeaders = headers.slice(0, -1);
    assert.equal(statementRows(provider.parse(rows.map((row) => row.slice(0, -1)), withoutBillHeaders)).length, 0);
  }
});

test("generic and custom statements do not label foreign amounts as ILS", () => {
  const genericHeaders = ["תאריך", "תיאור", "סכום עסקה", "מטבע עסקה", "סכום חיוב בש״ח"];
  const genericRows = [["16/09/2026", "shop", "30", "USD", "112.50"]];
  const generic = detectProvider(genericHeaders, genericRows);
  assert.equal(generic.id, "generic_bank");
  assert.equal(statementRows(generic.parse(genericRows, genericHeaders))[0].amount, 112.5);
  assert.equal(statementRows(generic.parse(genericRows.map((row) => row.slice(0, -1)), genericHeaders.slice(0, -1))).length, 0);

  const custom = financialProviders.find((provider) => provider.id === "custom");
  const customHeaders = ["date", "description", "amount", "currency"];
  const customRows = [["2026-09-16", "shop", "30", "USD"]];
  assert.equal(statementRows(custom.parse(customRows, customHeaders)).length, 0);
});

test("card selection excludes another card and separates unidentified rows", () => {
  const rows = [
    { raw_data: { "מספר כרטיס": "****1234" } },
    { raw_data: { "מספר כרטיס": "****5678" } },
    { raw_data: { merchant: "shop" } },
  ];
  const selected = selectCardRows(rows, "1234");
  assert.equal(selected.matching.length, 1);
  assert.equal(selected.unidentified.length, 1);
  assert.equal(selected.excluded, 1);
});

test("stored statement metadata omits full card and authentication fields", () => {
  const [row] = sanitizeStatementRows([{
    transaction_date: "2026-09-16", amount: 100, direction: "expense", description: "shop",
    raw_data: { "מספר כרטיס": "1234567890121234", CVV: "123", "תאריך חיוב": "10/10/2026" },
  }]);
  assert.deepEqual(row.raw_data, { "תאריך חיוב": "10/10/2026" });
});

test("future statement charges are scoped to one card and grouped by due date", () => {
  const rows = [
    { source_type: "credit_card_import", source_connection_id: "card-a", direction: "expense", amount: 100, raw_data: { billing_date: "2026-10-10" } },
    { source_type: "credit_card_import", source_connection_id: "card-a", direction: "expense", amount: 50, raw_data: { billing_date: "2026-10-10" } },
    { source_type: "credit_card_import", source_connection_id: "card-b", direction: "expense", amount: 900, raw_data: { billing_date: "2026-10-10" } },
    { source_type: "credit_card_import", source_connection_id: "card-a", direction: "expense", amount: 70, raw_data: { billing_date: "2026-08-10" } },
  ];
  assert.deepEqual(futureStatementCharges(rows, "csv-card:card-a", "2026-09-16", "2026-12-15"), [
    { billingDate: "2026-10-10", amount: 150 },
  ]);
});

test("a CSV-only card estimates the next month, including year and month ends", () => {
  assert.equal(nextCsvBillingEstimateDate("2026-09-16", 10), "2026-10-10");
  assert.equal(nextCsvBillingEstimateDate("2026-01-31", 31), "2026-02-28");
  assert.equal(nextCsvBillingEstimateDate("2026-12-20", 10), "2027-01-10");
});
