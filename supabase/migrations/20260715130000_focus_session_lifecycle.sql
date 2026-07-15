ALTER TABLE public.zoneflow_focus_sessions
  ADD COLUMN IF NOT EXISTS planned_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS accumulated_pause_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS goal_text text,
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_goal_id uuid REFERENCES public.dream_goals(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.zoneflow_focus_sessions
    ADD CONSTRAINT zoneflow_focus_sessions_status_check
    CHECK (status IN ('running', 'paused', 'completed', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.zoneflow_focus_sessions
SET status = CASE WHEN completed THEN 'completed' ELSE 'cancelled' END,
    completed_at = CASE WHEN completed THEN ended_at ELSE NULL END,
    planned_end_at = coalesce(planned_end_at, started_at + make_interval(secs => duration_seconds))
WHERE status = 'running' AND created_at < now() - interval '12 hours';

CREATE INDEX IF NOT EXISTS zoneflow_focus_sessions_user_started_idx
  ON public.zoneflow_focus_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS zoneflow_focus_sessions_user_status_idx
  ON public.zoneflow_focus_sessions (user_id, status, started_at DESC);
