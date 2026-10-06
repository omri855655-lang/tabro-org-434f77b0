ALTER TABLE public.recurring_task_skips ADD COLUMN IF NOT EXISTS skipped_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.finance_club_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('voucher', 'points', 'benefit')),
  label text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  expiry_date date,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_club_assets TO authenticated;
GRANT ALL ON public.finance_club_assets TO service_role;
ALTER TABLE public.finance_club_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own finance club assets" ON public.finance_club_assets
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());