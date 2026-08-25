-- Credentials used by the cloud scraper are server-only and encrypted by the worker.
CREATE TABLE IF NOT EXISTS public.finance_scraper_credentials (
  connection_id UUID PRIMARY KEY REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_scraper_credentials ENABLE ROW LEVEL SECURITY;

-- No client policies or grants: only the service-role worker may read this table.
REVOKE ALL ON TABLE public.finance_scraper_credentials FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_finance_scraper_credentials_user
  ON public.finance_scraper_credentials (user_id, company_id);

DROP TRIGGER IF EXISTS update_finance_scraper_credentials_updated_at
  ON public.finance_scraper_credentials;
CREATE TRIGGER update_finance_scraper_credentials_updated_at
  BEFORE UPDATE ON public.finance_scraper_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bank_connections_cloud_scraper
  ON public.bank_connections (user_id, integration_provider, status)
  WHERE integration_provider = 'cloud_scraper';
