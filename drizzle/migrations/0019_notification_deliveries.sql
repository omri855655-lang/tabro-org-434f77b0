-- Durable per-user/item/channel ledger for server notifications (important-mail alerts,
-- explicit push tests). Rows are claimed before any provider call so overlapping or
-- retried scheduler ticks cannot send the same alert twice.
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('important_mail', 'push_test')),
  item_key text NOT NULL CHECK (length(item_key) BETWEEN 1 AND 300),
  channel text NOT NULL CHECK (channel IN ('push', 'email')),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'accepted', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  retryable boolean NOT NULL DEFAULT true,
  lease_until timestamptz,
  batch_id uuid,
  devices_found integer,
  provider_accepted integer,
  provider_expired integer,
  provider_rejected integer,
  provider_status integer,
  provider_message_id text,
  last_error text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_identity
  ON public.notification_deliveries (user_id, kind, item_key, channel);
CREATE INDEX IF NOT EXISTS notification_deliveries_user_created
  ON public.notification_deliveries (user_id, created_at DESC);

REVOKE ALL ON public.notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification deliveries" ON public.notification_deliveries;
CREATE POLICY "Users can view their own notification deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_notification_deliveries_updated_at ON public.notification_deliveries;
CREATE TRIGGER update_notification_deliveries_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Returns a row only for the single caller allowed to send now: a new identity, a
-- retryable failure, or an abandoned (lease-expired) send.
CREATE OR REPLACE FUNCTION public.claim_notification_delivery(
  p_user_id uuid, p_kind text, p_item_key text, p_channel text, p_batch_id uuid,
  p_lease_seconds integer DEFAULT 300, p_max_attempts integer DEFAULT 3
)
RETURNS TABLE(delivery_id uuid, attempt integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.notification_deliveries AS d
    (user_id, kind, item_key, channel, status, attempts, lease_until, batch_id)
  VALUES
    (p_user_id, p_kind, p_item_key, p_channel, 'sending', 1, now() + make_interval(secs => p_lease_seconds), p_batch_id)
  ON CONFLICT (user_id, kind, item_key, channel) DO UPDATE
    SET status = 'sending',
        attempts = d.attempts + 1,
        lease_until = now() + make_interval(secs => p_lease_seconds),
        batch_id = p_batch_id,
        updated_at = now()
    WHERE d.attempts < p_max_attempts
      AND ((d.status = 'failed' AND d.retryable) OR (d.status = 'sending' AND d.lease_until < now()))
  RETURNING d.id, d.attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_delivery(uuid, text, text, text, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery(uuid, text, text, text, uuid, integer, integer) TO service_role;

-- Separate server-only scheduler token for important-mail alerts (generated in-database).
INSERT INTO private.scheduler_tokens (name) VALUES ('important_mail') ON CONFLICT (name) DO NOTHING;