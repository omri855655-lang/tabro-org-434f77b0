interface LiquidAccount {
  provider_name: string | null;
  external_account_id: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number | null;
  available_balance: number | null;
}

export function summarizeLiquidBalances(accounts: LiquidAccount[]) {
  const seen = new Set<string>();
  let available = 0;
  let debt = 0;

  for (const account of accounts) {
    const key = `${account.provider_name || ""}:${account.external_account_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (account.account_type?.toUpperCase() === "CARD" || (account.currency && account.currency !== "ILS")) continue;
    const value = account.available_balance ?? account.current_balance;
    if (value == null || !Number.isFinite(value)) continue;
    if (value >= 0) available += value;
    else debt += Math.abs(value);
  }

  return { available, debt, liquid: available - debt };
}
