CREATE TABLE IF NOT EXISTS public.calendar_feed_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  include_description boolean NOT NULL DEFAULT false,
  include_location boolean NOT NULL DEFAULT false,
  include_meeting_url boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_fetched_at timestamptz,
  last_event_count integer,
  last_skipped_count integer,
  last_truncated boolean
);

COMMENT ON TABLE public.calendar_feed_subscriptions IS 'Private revocable calendar subscription links. Stores only SHA-256 token hashes. Service-role access only; managed by calendar-feed-manage, read by calendar-feed.';

CREATE UNIQUE INDEX IF NOT EXISTS calendar_feed_subscriptions_one_active_per_user
  ON public.calendar_feed_subscriptions (user_id) WHERE revoked_at IS NULL;

REVOKE ALL ON public.calendar_feed_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.calendar_feed_subscriptions TO service_role;

ALTER TABLE public.calendar_feed_subscriptions ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: clients can never read or write rows (including hashes).