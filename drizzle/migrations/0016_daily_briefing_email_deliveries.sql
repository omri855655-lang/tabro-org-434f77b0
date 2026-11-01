-- Durable, per-user/date/slot delivery ledger for the opt-in daily briefing email.
CREATE TABLE IF NOT EXISTS public.daily_briefing_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  local_date date NOT NULL,
  slot text NOT NULL CHECK (slot IN ('morning', 'afternoon')),
  kind text NOT NULL DEFAULT 'scheduled' CHECK (kind IN ('scheduled', 'test')),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'accepted', 'failed', 'skipped', 'duplicate_suppressed')),
  attempts integer NOT NULL DEFAULT 0,
  retryable boolean NOT NULL DEFAULT true,
  lease_until timestamptz,
  idempotency_key text NOT NULL,
  provider_message_id text,
  provider_status integer,
  last_error text,
  item_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_pages integer,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_briefing_deliveries_scheduled_key
  ON public.daily_briefing_deliveries (user_id, local_date, slot) WHERE kind = 'scheduled';
CREATE INDEX IF NOT EXISTS daily_briefing_deliveries_user_created
  ON public.daily_briefing_deliveries (user_id, created_at DESC);

REVOKE ALL ON public.daily_briefing_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.daily_briefing_deliveries TO authenticated;
GRANT ALL ON public.daily_briefing_deliveries TO service_role;

ALTER TABLE public.daily_briefing_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own briefing deliveries" ON public.daily_briefing_deliveries;
CREATE POLICY "Users can view their own briefing deliveries"
  ON public.daily_briefing_deliveries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_daily_briefing_deliveries_updated_at ON public.daily_briefing_deliveries;
CREATE TRIGGER update_daily_briefing_deliveries_updated_at
  BEFORE UPDATE ON public.daily_briefing_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomically claim a scheduled slot. Returns a row only for the single caller that
-- may send now: a new slot, a retryable failure, or an abandoned (lease-expired) send.
CREATE OR REPLACE FUNCTION public.claim_daily_briefing(
  p_user_id uuid, p_local_date date, p_slot text,
  p_lease_seconds integer DEFAULT 300, p_max_attempts integer DEFAULT 4
)
RETURNS TABLE(delivery_id uuid, attempt integer, idem_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_slot NOT IN ('morning', 'afternoon') THEN
    RAISE EXCEPTION 'Invalid slot';
  END IF;
  RETURN QUERY
  INSERT INTO public.daily_briefing_deliveries AS d
    (user_id, local_date, slot, kind, status, attempts, lease_until, idempotency_key)
  VALUES
    (p_user_id, p_local_date, p_slot, 'scheduled', 'sending', 1,
     now() + make_interval(secs => p_lease_seconds),
     'tabro-briefing/' || p_user_id::text || '/' || p_local_date::text || '/' || p_slot)
  ON CONFLICT (user_id, local_date, slot) WHERE kind = 'scheduled' DO UPDATE
    SET status = 'sending',
        attempts = d.attempts + 1,
        lease_until = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    WHERE d.attempts < p_max_attempts
      AND ((d.status = 'failed' AND d.retryable) OR (d.status = 'sending' AND d.lease_until < now()))
  RETURNING d.id, d.attempts, d.idempotency_key;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_briefing(uuid, date, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_briefing(uuid, date, text, integer, integer) TO service_role;

-- Scheduler tokens live in a schema that the Data API never exposes. The value is
-- generated inside the database, is not part of this file, and only the scheduler
-- (running as the database owner) and the service-only check below can read it.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.scheduler_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.scheduler_tokens FROM PUBLIC, anon, authenticated;

INSERT INTO private.scheduler_tokens (name) VALUES ('daily_briefing') ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_scheduler_token(p_name text, p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(length(p_token), 0) >= 32 AND EXISTS (
    SELECT 1 FROM private.scheduler_tokens t WHERE t.name = p_name AND t.token = p_token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_scheduler_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_scheduler_token(text, text) TO service_role;
