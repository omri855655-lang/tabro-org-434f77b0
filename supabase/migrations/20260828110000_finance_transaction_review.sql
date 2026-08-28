ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.payment_tracking
  ADD COLUMN IF NOT EXISTS recurrence_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_source_transaction_id text;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_visible_date
  ON public.financial_transactions (user_id, hidden, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_payment_tracking_user_recurrence
  ON public.payment_tracking (user_id, recurring, recurrence_status, recurrence_end_date);

COMMENT ON COLUMN public.financial_transactions.hidden IS
  'User-controlled visibility flag. Hidden synced transactions remain stored and can be restored.';

COMMENT ON COLUMN public.payment_tracking.recurrence_status IS
  'Lifecycle of a recurring plan: active, paused, or ended.';

CREATE TABLE IF NOT EXISTS public.finance_club_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'voucher' CHECK (asset_type IN ('voucher', 'points', 'benefit')),
  label text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  expiry_date date,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_club_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own finance club assets" ON public.finance_club_assets;
CREATE POLICY "Users can manage own finance club assets"
  ON public.finance_club_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_finance_club_assets_user_expiry
  ON public.finance_club_assets (user_id, archived, expiry_date);
