BEGIN;
CREATE TABLE public.zoneflow_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  direction text NOT NULL CHECK (direction IN ('build', 'reduce')),
  cue text NOT NULL DEFAULT '' CHECK (char_length(cue) <= 500),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 500),
  weekdays integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]
    CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]),
  target_days integer NOT NULL DEFAULT 30 CHECK (target_days BETWEEN 1 AND 365),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, user_id)
);
CREATE INDEX zoneflow_habits_owner ON public.zoneflow_habits(user_id);

CREATE TABLE public.zoneflow_habit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('checkin', 'urge')),
  entry_date date NOT NULL,
  outcome text CHECK (outcome IN ('done', 'partial', 'missed')),
  intensity integer CHECK (intensity BETWEEN 1 AND 10),
  trigger text NOT NULL DEFAULT '' CHECK (char_length(trigger) <= 1000),
  response text NOT NULL DEFAULT '' CHECK (char_length(response) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (habit_id, user_id) REFERENCES public.zoneflow_habits(id, user_id) ON DELETE CASCADE,
  CHECK ((kind = 'checkin' AND outcome IS NOT NULL AND intensity IS NULL)
      OR (kind = 'urge' AND outcome IS NULL AND intensity IS NOT NULL))
);
CREATE UNIQUE INDEX zoneflow_habit_daily_checkin ON public.zoneflow_habit_entries(user_id, habit_id, entry_date) WHERE kind = 'checkin';
CREATE INDEX zoneflow_habit_entries_owner_date ON public.zoneflow_habit_entries(user_id, entry_date DESC);

ALTER TABLE public.zoneflow_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoneflow_habit_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zoneflow_habits, public.zoneflow_habit_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoneflow_habits, public.zoneflow_habit_entries TO authenticated;
GRANT ALL ON public.zoneflow_habits, public.zoneflow_habit_entries TO service_role;
CREATE POLICY habit_owner ON public.zoneflow_habits TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY habit_entry_owner ON public.zoneflow_habit_entries TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
COMMIT;
