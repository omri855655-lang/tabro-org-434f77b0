ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_recurrence_rule_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_recurrence_rule_check
  CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly'));

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_group
  ON public.calendar_events (user_id, recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

COMMENT ON COLUMN public.calendar_events.location IS 'Physical location displayed in the planner event details.';
COMMENT ON COLUMN public.calendar_events.meeting_url IS 'Optional HTTPS meeting link for a calendar event.';
COMMENT ON COLUMN public.calendar_events.recurrence_group_id IS 'Groups generated event occurrences without enabling destructive series-wide edits.';
