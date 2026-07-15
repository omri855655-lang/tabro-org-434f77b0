CREATE TABLE IF NOT EXISTS public.zoneflow_mind_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id text NOT NULL,
  journey_title text NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_pattern text NOT NULL CHECK (primary_pattern IN ('clarity', 'fear', 'energy', 'overload', 'distraction')),
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, journey_id)
);

ALTER TABLE public.zoneflow_mind_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their private Mind assessments"
  ON public.zoneflow_mind_assessments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS zoneflow_mind_assessments_user_updated_idx
  ON public.zoneflow_mind_assessments (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoneflow_mind_assessments TO authenticated;
