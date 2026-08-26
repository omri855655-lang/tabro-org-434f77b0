-- Server-only audit trail used to throttle sensitive finance actions.
CREATE TABLE IF NOT EXISTS public.finance_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('connect', 'sync')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_security_events FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_finance_security_events_rate_limit
  ON public.finance_security_events (user_id, action, created_at DESC);

CREATE OR REPLACE FUNCTION public.check_finance_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_attempts INTEGER;
BEGIN
  IF p_action NOT IN ('connect', 'sync')
     OR p_limit < 1 OR p_limit > 100
     OR p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT), hashtext(p_action));

  DELETE FROM public.finance_security_events
  WHERE user_id = p_user_id
    AND created_at < now() - interval '1 day';

  SELECT count(*) INTO recent_attempts
  FROM public.finance_security_events
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at >= now() - make_interval(secs => p_window_seconds);

  IF recent_attempts >= p_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.finance_security_events (user_id, action)
  VALUES (p_user_id, p_action);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.check_finance_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_finance_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- Reassert that encrypted bank credentials can never be queried by browser roles.
ALTER TABLE public.finance_scraper_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_scraper_credentials FROM PUBLIC, anon, authenticated;
