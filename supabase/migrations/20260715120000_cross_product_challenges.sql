INSERT INTO public.tabro_scoring_rules
  (event_type, source, base_points, points_per_unit, daily_cap_points, cooldown_seconds, reason_template)
VALUES
  ('important_task_completed', 'tasks', 3, 0, 15, 0, 'Important task bonus'),
  ('goal_completed', 'goals', 15, 0, 30, 0, 'Goal completed'),
  ('challenge_completed', 'challenge_reward_10', 10, 0, 40, 0, 'Cross-product challenge completed'),
  ('challenge_completed', 'challenge_reward_20', 20, 0, 60, 0, 'Cross-product challenge completed'),
  ('challenge_completed', 'challenge_reward_30', 30, 0, 90, 0, 'Cross-product challenge completed')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tabro_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_he text NOT NULL,
  title_en text NOT NULL,
  description_he text NOT NULL,
  description_en text NOT NULL,
  cadence text NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily', 'weekly', 'monthly', 'once')),
  reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  starts_at date,
  ends_at date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tabro_challenge_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.tabro_challenges(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text,
  metric text NOT NULL DEFAULT 'count' CHECK (metric IN ('count', 'duration', 'amount')),
  target numeric(12, 2) NOT NULL CHECK (target > 0),
  label_he text NOT NULL,
  label_en text NOT NULL,
  destination text,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (challenge_id, event_type, source)
);

CREATE TABLE IF NOT EXISTS public.tabro_challenge_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition_id uuid NOT NULL REFERENCES public.tabro_challenge_conditions(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  current_value numeric(12, 2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, condition_id, period_key)
);

CREATE TABLE IF NOT EXISTS public.tabro_challenge_completions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.tabro_challenges(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id, period_key)
);

CREATE INDEX IF NOT EXISTS tabro_challenge_progress_user_updated_idx
  ON public.tabro_challenge_progress (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS tabro_challenge_conditions_event_idx
  ON public.tabro_challenge_conditions (event_type, source);

ALTER TABLE public.tabro_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_challenge_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabro_challenge_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active challenges"
  ON public.tabro_challenges FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Authenticated users can read challenge conditions"
  ON public.tabro_challenge_conditions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tabro_challenges c WHERE c.id = challenge_id AND c.active = true));
CREATE POLICY "Users can read their challenge progress"
  ON public.tabro_challenge_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read their challenge completions"
  ON public.tabro_challenge_completions FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.tabro_challenges
  (id, slug, title_he, title_en, description_he, description_en, cadence, reward_points)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'focused-week', 'שבוע ממוקד', 'Focused week', 'שילוב מאוזן של משימות, ריכוז, קריאה ורווחה דיגיטלית.', 'A balanced mix of tasks, focus, reading and digital wellbeing.', 'weekly', 20),
  ('10000000-0000-4000-8000-000000000002', 'deep-work-day', 'יום עבודה עמוקה', 'Deep work day', 'ריכוז משמעותי וזמן נקי מהסחות באותו יום.', 'Meaningful focus and distraction-free time in one day.', 'daily', 10),
  ('10000000-0000-4000-8000-000000000003', 'momentum-month', 'חודש של תנופה', 'Momentum month', 'התקדמות עקבית במשימות ובמטרות.', 'Consistent progress across tasks and goals.', 'monthly', 30)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tabro_challenge_conditions
  (id, challenge_id, event_type, source, metric, target, label_he, label_en, destination, sort_order)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'task_completed', 'tasks', 'count', 5, 'השלמת 5 משימות', 'Complete 5 tasks', 'personalTasks', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'focus_session_completed', 'zoneflow_together', 'count', 3, '3 חדרי ריכוז', 'Complete 3 focus rooms', 'zoneflow', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'wellbeing_session_completed', 'digital_wellbeing', 'duration', 120, '120 דקות ללא הסחות', '120 distraction-free minutes', 'zoneflow', 3),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'book_completed', 'books', 'count', 1, 'סיום ספר', 'Finish a book', 'books', 4),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'mind_exercise_completed', 'zoneflow_mind', 'count', 1, 'תרגיל ZoneFlow Mind', 'Complete a Mind exercise', 'zoneflow', 5),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'focus_session_completed', NULL, 'duration', 50, '50 דקות ריכוז', '50 focus minutes', 'zoneflow', 1),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', 'wellbeing_session_completed', 'digital_wellbeing', 'duration', 50, '50 דקות ללא הסחות', '50 distraction-free minutes', 'zoneflow', 2),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'task_completed', 'tasks', 'count', 20, 'השלמת 20 משימות', 'Complete 20 tasks', 'personalTasks', 1),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'goal_progress_recorded', 'goals', 'count', 4, '4 צעדים במטרות', 'Make 4 goal steps', 'dashboard', 2)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tabro_challenge_period_key(p_cadence text, p_date date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_cadence
    WHEN 'daily' THEN to_char(p_date, 'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char(date_trunc('week', p_date::timestamp), 'IYYY-"W"IW')
    WHEN 'monthly' THEN to_char(p_date, 'YYYY-MM')
    ELSE 'once'
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_tabro_challenge_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_condition public.tabro_challenge_conditions;
  v_challenge public.tabro_challenges;
  v_period_key text;
  v_delta numeric;
  v_inserted_completion uuid;
BEGIN
  FOR v_condition IN
    SELECT cc.* FROM public.tabro_challenge_conditions cc
    JOIN public.tabro_challenges c ON c.id = cc.challenge_id
    WHERE c.active = true AND cc.event_type = NEW.event_type
      AND (cc.source IS NULL OR cc.source = NEW.source)
      AND (c.starts_at IS NULL OR c.starts_at <= NEW.occurred_at::date)
      AND (c.ends_at IS NULL OR c.ends_at >= NEW.occurred_at::date)
  LOOP
    SELECT * INTO v_challenge FROM public.tabro_challenges WHERE id = v_condition.challenge_id;
    v_period_key := public.tabro_challenge_period_key(v_challenge.cadence, NEW.occurred_at::date);
    v_delta := CASE v_condition.metric
      WHEN 'duration' THEN greatest(coalesce(NEW.duration_minutes, 0), 0)
      WHEN 'amount' THEN greatest(coalesce(NEW.amount, 0), 0)
      ELSE 1 END;
    IF v_delta <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.tabro_challenge_progress (user_id, condition_id, period_key, current_value, completed_at)
    VALUES (NEW.user_id, v_condition.id, v_period_key, least(v_delta, v_condition.target), CASE WHEN v_delta >= v_condition.target THEN now() ELSE NULL END)
    ON CONFLICT (user_id, condition_id, period_key) DO UPDATE SET
      current_value = least(public.tabro_challenge_progress.current_value + v_delta, v_condition.target),
      completed_at = CASE WHEN public.tabro_challenge_progress.current_value + v_delta >= v_condition.target THEN coalesce(public.tabro_challenge_progress.completed_at, now()) ELSE NULL END,
      updated_at = now();

    IF NOT EXISTS (
      SELECT 1 FROM public.tabro_challenge_conditions required
      LEFT JOIN public.tabro_challenge_progress progress
        ON progress.condition_id = required.id AND progress.user_id = NEW.user_id AND progress.period_key = v_period_key
      WHERE required.challenge_id = v_challenge.id AND coalesce(progress.current_value, 0) < required.target
    ) THEN
      v_inserted_completion := NULL;
      INSERT INTO public.tabro_challenge_completions (user_id, challenge_id, period_key)
      VALUES (NEW.user_id, v_challenge.id, v_period_key)
      ON CONFLICT DO NOTHING
      RETURNING challenge_id INTO v_inserted_completion;
      IF v_inserted_completion IS NOT NULL THEN
        PERFORM public.record_tabro_activity(
          'challenge_completed', 'challenge_reward_' || v_challenge.reward_points::text,
          'auto-challenge:' || v_challenge.id::text || ':' || v_period_key,
          now(), jsonb_build_object('challengeId', v_challenge.id, 'slug', v_challenge.slug, 'rewardPoints', v_challenge.reward_points),
          v_challenge.id::text, NULL, NULL
        );
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tabro_activity_event_challenge_progress ON public.tabro_activity_events;
CREATE TRIGGER tabro_activity_event_challenge_progress
AFTER INSERT ON public.tabro_activity_events
FOR EACH ROW EXECUTE FUNCTION public.update_tabro_challenge_progress();

CREATE OR REPLACE FUNCTION public.tabro_challenge_dashboard()
RETURNS TABLE (
  challenge_id uuid, slug text, title_he text, title_en text, description_he text, description_en text,
  cadence text, reward_points integer, period_key text, condition_id uuid, event_type text,
  label_he text, label_en text, destination text, target numeric, current_value numeric, condition_completed boolean,
  challenge_completed boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.slug, c.title_he, c.title_en, c.description_he, c.description_en,
    c.cadence, c.reward_points, public.tabro_challenge_period_key(c.cadence, current_date),
    cc.id, cc.event_type, cc.label_he, cc.label_en, cc.destination, cc.target,
    coalesce(cp.current_value, 0), coalesce(cp.current_value, 0) >= cc.target,
    completion.challenge_id IS NOT NULL
  FROM public.tabro_challenges c
  JOIN public.tabro_challenge_conditions cc ON cc.challenge_id = c.id
  LEFT JOIN public.tabro_challenge_progress cp ON cp.condition_id = cc.id AND cp.user_id = auth.uid()
    AND cp.period_key = public.tabro_challenge_period_key(c.cadence, current_date)
  LEFT JOIN public.tabro_challenge_completions completion ON completion.challenge_id = c.id AND completion.user_id = auth.uid()
    AND completion.period_key = public.tabro_challenge_period_key(c.cadence, current_date)
  WHERE c.active = true AND (c.starts_at IS NULL OR c.starts_at <= current_date) AND (c.ends_at IS NULL OR c.ends_at >= current_date)
  ORDER BY c.created_at, cc.sort_order;
$$;

REVOKE ALL ON FUNCTION public.tabro_challenge_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tabro_challenge_dashboard() TO authenticated;
GRANT SELECT ON public.tabro_challenges, public.tabro_challenge_conditions, public.tabro_challenge_progress, public.tabro_challenge_completions TO authenticated;
