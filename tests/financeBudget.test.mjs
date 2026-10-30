import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBudgetMovements, analyzeBudgetPeriod } from "../src/lib/financeBudget.ts";
const row = (id, amount, extra = {}) => ({ id, amount, currency: "ILS", created_at: "2026-10-26", category: "אחר", payment_type: "expense", paid: true, title: id, ...extra });
test("budget includes recurring, savings and transfers; only identified credits offset outflows", () => {
  const entries = [row("fixed", 100, { recurring: true }), row("saving", 50, { category: "חיסכון" }), row("transfer", 30, { category: "העברות" }), row("credit", 20, { payment_type: "income", statement_credit: true }), row("salary", 999, { payment_type: "income" }), row("pending", 80, { paid: false }), row("hidden", 80, { hidden: true }), row("foreign", 80, { currency: "USD" }), row("future", 80, { created_at: "2026-11-01" }), row("fixed", 100), row("invalid", NaN)];
  const summary = summarizeBudgetMovements(entries, "2026-10-30");
  assert.equal(summary.outgoing, 180); assert.equal(summary.refunds, 20); assert.equal(summary.net, 160);
});
test("weekly comparisons start Sunday and compare equal elapsed days, not a whole prior week", () => {
  const summary = analyzeBudgetPeriod([row("now", 100), row("prior", 50, { created_at: "2026-10-19" }), row("prior-sat", 999, { created_at: "2026-10-24" })], "weekly", "2026-10-30");
  assert.equal(summary.start, "2026-10-25"); assert.equal(summary.previousNet, 50); assert.equal(summary.change, 100);
});
test("month comparison clamps shorter months and allows net refunds without treating income as refunds", () => {
  const summary = analyzeBudgetPeriod([row("now", 20, { created_at: "2026-03-31", payment_type: "income", statement_credit: true }), row("old", 100, { created_at: "2026-02-28" })], "monthly", "2026-03-31");
  assert.equal(summary.previousNet, 100); assert.equal(summary.net, -20); assert.equal(summary.change, -120);
});
