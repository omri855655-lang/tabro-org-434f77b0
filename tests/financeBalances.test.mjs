import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLiquidBalances } from "../src/lib/financeBalances.ts";

test("card balance and available credit do not become debt or liquid cash", () => {
  const summary = summarizeLiquidBalances([
    { provider_name: "Bank", external_account_id: "checking", account_type: "CHECKING", currency: "ILS", current_balance: 20000, available_balance: null },
    { provider_name: "Bank", external_account_id: "overdraft", account_type: "CHECKING", currency: "ILS", current_balance: -2000, available_balance: null },
    { provider_name: "Visa Cal", external_account_id: "card", account_type: "CARD", currency: "ILS", current_balance: -11000, available_balance: 11000 },
    { provider_name: "Bank", external_account_id: "checking", account_type: "CHECKING", currency: "ILS", current_balance: 20000, available_balance: null },
  ]);
  assert.deepEqual(summary, { available: 20000, debt: 2000, liquid: 18000 });
});
