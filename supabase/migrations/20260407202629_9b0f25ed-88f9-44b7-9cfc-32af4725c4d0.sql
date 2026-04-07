
-- financial_transactions table
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_connection_id UUID,
  provider TEXT,
  external_transaction_id TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_date DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  direction TEXT NOT NULL DEFAULT 'expense',
  description TEXT,
  merchant TEXT,
  category TEXT,
  subcategory TEXT,
  installment_total INTEGER,
  installment_number INTEGER,
  billing_day INTEGER,
  month_key TEXT DEFAULT to_char(now(), 'YYYY-MM'),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own financial transactions"
  ON public.financial_transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_dedup
  ON public.financial_transactions (user_id, source_type, COALESCE(source_connection_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(external_transaction_id, ''));

CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date
  ON public.financial_transactions (user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_month
  ON public.financial_transactions (user_id, month_key);

CREATE TRIGGER update_financial_transactions_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- financial_sync_logs table
CREATE TABLE IF NOT EXISTS public.financial_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID,
  provider TEXT,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_finished_at TIMESTAMP WITH TIME ZONE,
  imported_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync logs"
  ON public.financial_sync_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- unique constraint on email_connections
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_connections_unique
  ON public.email_connections (user_id, provider, email_address);
