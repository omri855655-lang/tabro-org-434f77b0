-- Open Finance connections stay user-owned; credentials remain Edge Function secrets.
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS integration_provider TEXT NOT NULL DEFAULT 'salt_edge',
  ADD COLUMN IF NOT EXISTS external_connection_id TEXT,
  ADD COLUMN IF NOT EXISTS external_user_id TEXT,
  ADD COLUMN IF NOT EXISTS consent_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS callback_state_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_external_provider
  ON public.bank_connections (user_id, integration_provider, external_connection_id)
  WHERE external_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_connections_callback_state
  ON public.bank_connections (callback_state_hash)
  WHERE callback_state_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_account_id TEXT NOT NULL,
  provider_id TEXT,
  provider_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'CHECKING',
  display_name TEXT,
  masked_number TEXT,
  currency TEXT NOT NULL DEFAULT 'ILS',
  current_balance NUMERIC,
  available_balance NUMERIC,
  balance_type TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, external_account_id)
);

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own financial accounts" ON public.financial_accounts;
CREATE POLICY "Users can manage own financial accounts"
  ON public.financial_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_user_type
  ON public.financial_accounts (user_id, account_type);

DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON public.financial_accounts;
CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.financial_accounts TO authenticated;
