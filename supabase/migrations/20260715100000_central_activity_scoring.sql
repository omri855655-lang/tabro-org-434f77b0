-- Central activity and scoring engine shared by ZoneFlow, books, challenges and tasks.
CREATE TABLE IF NOT EXISTS public.tabro_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 2 AND 80),
  source text NOT NULL CHECK (char_length(trim(source)) BETWEEN 2 AND 80),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  reference_id text,
  duration_minutes numeric(10, 2) CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  amount numeric(12, 2),
  idempotency_key text NOT NULL CHECK (char_length(trim(idempotency_key)) BETWEEN 3 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.tabro_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text,
  enabled boolean NOT NULL DEFAULT true,
  base_points integer NOT NULL DEFAULT 0 CHECK (base_points >= 0),
  points_per_unit integer NOT NULL DEFAULT 0 CHECK (points_per_unit >= 0),
  unit_minutes numeric(10, 2) CHECK (unit_minutes IS NULL OR unit_minutes > 0),
  min_duration_minutes numeric(10, 2) CHECK (min_duration_minutes IS NULL OR min_duration_minutes >= 0),
  max_rewarded_duration_minutes numeric(10, 2) CHECK (max_rewarded_duration_minutes IS NULL OR max_rewarded_duration_minutes > 0),
  daily_cap_points integer CHECK (daily_cap_points IS NULL OR daily_cap_points >= 0),
  cooldown_seconds integer NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0),
  reason_template text NOT NULL DEFAULT 'Activity completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tabro_scoring_rules_event_source_key
  ON public.tabro_scoring_rules (event_type, coalesce(source, '*'));

CREATE TABLE IF NOT EXISTS public.tabro_reward_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points integer NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tabro_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_event_id uuid NOT NULL UNIQUE REFERENCES public.tabro_activity_events(id) ON DELETE CASCADE,
  scoring_rule_id uuid REFERENCES public.tabro_scoring_rules(id) ON DELETE SET NULL,
  points integer NOT NULL CHECK (points <> 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tabro_activity_streaks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_key text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak integer NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_activity_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, streak_key)
);

CREATE INDEX IF NOT EXISTS tabro_activity_events_user_occurred_idx
  ON public.tabro_activity_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tabro_activity_events_type_idx
  ON public.tabro_activity_events (user_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tabro_reward_ledger_user_created_idx
  ON public.tabro_reward_ledger (user_id, created_at DESC);

ALTER TABLE public.tabro_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_reward_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_activity_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their activity events"
  ON public.tabro_activity_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Authenticated users can read enabled scoring rules"
  ON public.tabro_scoring_rules FOR SELECT TO authenticated
  USING (enabled = true);
CREATE POLICY "Users can read their reward profile"
  ON public.tabro_reward_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can read their reward ledger"
  ON public.tabro_reward_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can read their activity streaks"
  ON public.tabro_activity_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.tabro_scoring_rules
  (event_type, source, base_points, points_per_unit, unit_minutes, min_duration_minutes, max_rewarded_duration_minutes, daily_cap_points, cooldown_seconds, reason_template)
VALUES
  ('focus_session_completed', 'zoneflow_core', 0, 1, 3, 3, 180, 60, 60, 'ZoneFlow focus completed'),
  ('focus_session_completed', 'zoneflow_together', 1, 1, 3, 3, 180, 80, 60, 'Shared focus room completed'),
  ('wellbeing_session_completed', 'digital_wellbeing', 1, 1, 3, 3, 180, 60, 60, 'Distraction-free session completed'),
  ('pomodoro_completed', 'zoneflow_together', 2, 1, 5, 10, 120, 40, 60, 'Pomodoro completed'),
  ('book_completed', 'books', 5, 1, 25, NULL, NULL, 80, 0, 'Book completed'),
  ('task_completed', 'tasks', 2, 0, NULL, NULL, NULL, 30, 0, 'Task completed'),
  ('goal_progress_recorded', 'goals', 1, 0, NULL, NULL, NULL, 15, 300, 'Goal progress recorded'),
  ('mind_exercise_completed', 'zoneflow_mind', 5, 0, NULL, NULL, NULL, 30, 0, 'Mind exercise completed'),
  ('journey_day_completed', 'zoneflow_mind', 5, 0, NULL, NULL, NULL, 10, 0, 'Journey day completed'),
  ('challenge_completed', 'challenges', 5, 0, NULL, NULL, NULL, 40, 0, 'Challenge completed'),
  ('achievement_unlocked', 'challenges', 10, 0, NULL, NULL, NULL, 60, 0, 'Achievement unlocked')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_tabro_activity(
  p_event_type text,
  p_source text,
  p_idempotency_key text,
  p_occurred_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_reference_id text DEFAULT NULL,
  p_duration_minutes numeric DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.tabro_activity_events;
  v_rule public.tabro_scoring_rules;
  v_profile public.tabro_reward_profiles;
  v_ledger public.tabro_reward_ledger;
  v_points integer := 0;
  v_today_points integer := 0;
  v_last_award timestamptz;
  v_streak_key text;
  v_streak public.tabro_activity_streaks;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF nullif(trim(p_event_type), '') IS NULL OR nullif(trim(p_source), '') IS NULL OR nullif(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'event_type, source and idempotency_key are required';
  END IF;
  IF p_duration_minutes IS NOT NULL AND p_duration_minutes < 0 THEN
    RAISE EXCEPTION 'duration_minutes cannot be negative';
  END IF;

  SELECT * INTO v_event FROM public.tabro_activity_events
  WHERE user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN
    SELECT * INTO v_ledger FROM public.tabro_reward_ledger WHERE activity_event_id = v_event.id;
    SELECT * INTO v_profile FROM public.tabro_reward_profiles WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'event_id', v_event.id, 'duplicate', true,
      'awarded_points', coalesce(v_ledger.points, 0),
      'reason', coalesce(v_ledger.reason, 'Already recorded'),
      'balance', coalesce(v_profile.points_balance, 0),
      'xp', coalesce(v_profile.xp, 0), 'level', coalesce(v_profile.level, 1)
    );
  END IF;

  INSERT INTO public.tabro_activity_events
    (user_id, event_type, source, occurred_at, metadata, reference_id, duration_minutes, amount, idempotency_key)
  VALUES
    (v_user_id, trim(p_event_type), trim(p_source), coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb), p_reference_id, p_duration_minutes, p_amount, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_event;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM public.tabro_activity_events
    WHERE user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);
    SELECT * INTO v_ledger FROM public.tabro_reward_ledger WHERE activity_event_id = v_event.id;
    SELECT * INTO v_profile FROM public.tabro_reward_profiles WHERE user_id = v_user_id;
    RETURN jsonb_build_object(
      'event_id', v_event.id, 'duplicate', true,
      'awarded_points', coalesce(v_ledger.points, 0),
      'reason', coalesce(v_ledger.reason, 'Already recorded'),
      'balance', coalesce(v_profile.points_balance, 0),
      'xp', coalesce(v_profile.xp, 0), 'level', coalesce(v_profile.level, 1)
    );
  END IF;

  SELECT * INTO v_rule FROM public.tabro_scoring_rules
  WHERE enabled = true AND event_type = v_event.event_type AND (source = v_event.source OR source IS NULL)
  ORDER BY (source IS NOT NULL) DESC LIMIT 1;

  INSERT INTO public.tabro_reward_profiles (user_id) VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_profile FROM public.tabro_reward_profiles WHERE user_id = v_user_id FOR UPDATE;

  IF v_rule.id IS NULL OR (v_rule.min_duration_minutes IS NOT NULL AND coalesce(v_event.duration_minutes, 0) < v_rule.min_duration_minutes) THEN
    RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', false, 'awarded_points', 0, 'reason', 'Recorded without points', 'balance', v_profile.points_balance, 'xp', v_profile.xp, 'level', v_profile.level);
  END IF;

  IF v_rule.cooldown_seconds > 0 THEN
    SELECT max(l.created_at) INTO v_last_award
    FROM public.tabro_reward_ledger l
    JOIN public.tabro_activity_events e ON e.id = l.activity_event_id
    WHERE l.user_id = v_user_id AND l.scoring_rule_id = v_rule.id;
    IF v_last_award IS NOT NULL AND v_last_award > now() - make_interval(secs => v_rule.cooldown_seconds) THEN
      RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', false, 'awarded_points', 0, 'reason', 'Cooldown active', 'balance', v_profile.points_balance, 'xp', v_profile.xp, 'level', v_profile.level);
    END IF;
  END IF;

  v_points := v_rule.base_points;
  IF v_event.event_type = 'book_completed' AND v_event.amount IS NOT NULL AND v_rule.points_per_unit > 0 AND v_rule.unit_minutes IS NOT NULL THEN
    v_points := v_points + floor(greatest(v_event.amount, 0) / v_rule.unit_minutes)::integer * v_rule.points_per_unit;
  ELSIF v_rule.points_per_unit > 0 AND v_rule.unit_minutes IS NOT NULL THEN
    v_points := v_points + floor(least(coalesce(v_event.duration_minutes, 0), coalesce(v_rule.max_rewarded_duration_minutes, v_event.duration_minutes)) / v_rule.unit_minutes)::integer * v_rule.points_per_unit;
  END IF;

  IF v_rule.daily_cap_points IS NOT NULL THEN
    SELECT coalesce(sum(greatest(l.points, 0)), 0)::integer INTO v_today_points
    FROM public.tabro_reward_ledger l
    WHERE l.user_id = v_user_id AND l.scoring_rule_id = v_rule.id
      AND l.created_at >= date_trunc('day', now()) AND l.created_at < date_trunc('day', now()) + interval '1 day';
    v_points := least(v_points, greatest(v_rule.daily_cap_points - v_today_points, 0));
  END IF;

  IF v_points <= 0 THEN
    RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', false, 'awarded_points', 0, 'reason', 'Daily cap reached', 'balance', v_profile.points_balance, 'xp', v_profile.xp, 'level', v_profile.level);
  END IF;

  INSERT INTO public.tabro_reward_ledger (user_id, activity_event_id, scoring_rule_id, points, reason)
  VALUES (v_user_id, v_event.id, v_rule.id, v_points, v_rule.reason_template)
  RETURNING * INTO v_ledger;

  UPDATE public.tabro_reward_profiles SET
    xp = xp + v_points,
    lifetime_points = lifetime_points + v_points,
    points_balance = points_balance + v_points,
    level = greatest(1, floor(sqrt((xp + v_points)::numeric / 100))::integer + 1),
    updated_at = now()
  WHERE user_id = v_user_id RETURNING * INTO v_profile;

  v_streak_key := split_part(v_event.event_type, '_', 1);
  INSERT INTO public.tabro_activity_streaks (user_id, streak_key, current_streak, best_streak, last_activity_date)
  VALUES (v_user_id, v_streak_key, 1, 1, v_event.occurred_at::date)
  ON CONFLICT (user_id, streak_key) DO UPDATE SET
    current_streak = CASE
      WHEN public.tabro_activity_streaks.last_activity_date = excluded.last_activity_date THEN public.tabro_activity_streaks.current_streak
      WHEN public.tabro_activity_streaks.last_activity_date = excluded.last_activity_date - 1 THEN public.tabro_activity_streaks.current_streak + 1
      ELSE 1 END,
    best_streak = greatest(public.tabro_activity_streaks.best_streak, CASE
      WHEN public.tabro_activity_streaks.last_activity_date = excluded.last_activity_date THEN public.tabro_activity_streaks.current_streak
      WHEN public.tabro_activity_streaks.last_activity_date = excluded.last_activity_date - 1 THEN public.tabro_activity_streaks.current_streak + 1
      ELSE 1 END),
    last_activity_date = greatest(public.tabro_activity_streaks.last_activity_date, excluded.last_activity_date),
    updated_at = now();

  RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', false, 'awarded_points', v_points, 'reason', v_ledger.reason, 'balance', v_profile.points_balance, 'xp', v_profile.xp, 'level', v_profile.level);
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_tabro_reward_points(
  p_idempotency_key text,
  p_points integer,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.tabro_activity_events;
  v_profile public.tabro_reward_profiles;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_points IS NULL OR p_points <= 0 THEN RAISE EXCEPTION 'points must be positive'; END IF;

  SELECT * INTO v_event FROM public.tabro_activity_events WHERE user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN
    SELECT * INTO v_profile FROM public.tabro_reward_profiles WHERE user_id = v_user_id;
    RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', true, 'spent_points', 0, 'balance', coalesce(v_profile.points_balance, 0));
  END IF;

  INSERT INTO public.tabro_reward_profiles (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_profile FROM public.tabro_reward_profiles WHERE user_id = v_user_id FOR UPDATE;
  IF v_profile.points_balance < p_points THEN RAISE EXCEPTION 'Insufficient reward points'; END IF;

  INSERT INTO public.tabro_activity_events (user_id, event_type, source, metadata, amount, idempotency_key)
  VALUES (v_user_id, 'reward_points_spent', 'digital_wellbeing', coalesce(p_metadata, '{}'::jsonb), p_points, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_event;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('event_id', NULL, 'duplicate', true, 'spent_points', 0, 'balance', v_profile.points_balance);
  END IF;
  INSERT INTO public.tabro_reward_ledger (user_id, activity_event_id, points, reason)
  VALUES (v_user_id, v_event.id, -p_points, coalesce(nullif(trim(p_reason), ''), 'Reward points spent'));
  UPDATE public.tabro_reward_profiles SET points_balance = points_balance - p_points, updated_at = now()
  WHERE user_id = v_user_id RETURNING * INTO v_profile;
  RETURN jsonb_build_object('event_id', v_event.id, 'duplicate', false, 'spent_points', p_points, 'balance', v_profile.points_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.record_tabro_activity(text, text, text, timestamptz, jsonb, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spend_tabro_reward_points(text, integer, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_tabro_activity(text, text, text, timestamptz, jsonb, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tabro_reward_points(text, integer, text, jsonb) TO authenticated;
GRANT SELECT ON public.tabro_activity_events, public.tabro_scoring_rules, public.tabro_reward_profiles, public.tabro_reward_ledger, public.tabro_activity_streaks TO authenticated;
