-- Local finance connector devices. Bank credentials never enter this database.
CREATE TABLE IF NOT EXISTS public.finance_connector_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  platform TEXT,
  connector_version TEXT,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 360 CHECK (sync_interval_minutes BETWEEN 30 AND 10080),
  providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_connector_devices ENABLE ROW LEVEL SECURITY;

-- Device rows, including token hashes, are exposed only through the connector Edge Function.
REVOKE ALL ON public.finance_connector_devices FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_finance_connector_devices_user
  ON public.finance_connector_devices (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_finance_connector_devices_updated_at ON public.finance_connector_devices;
CREATE TRIGGER update_finance_connector_devices_updated_at
  BEFORE UPDATE ON public.finance_connector_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bank_connections_local_connector
  ON public.bank_connections (user_id, integration_provider, external_connection_id)
  WHERE integration_provider = 'local_scraper';
