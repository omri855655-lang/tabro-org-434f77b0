CREATE TABLE IF NOT EXISTS public.zoneflow_learning_history (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 120),
  completed_at timestamptz NOT NULL,
  category text NOT NULL CHECK (length(category) <= 200),
  subtopic text CHECK (length(subtopic) <= 200),
  level text CHECK (length(level) <= 40),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  content text CHECK (length(content) <= 20000),
  summary text NOT NULL CHECK (length(summary) <= 10000),
  feedback text CHECK (length(feedback) <= 10000),
  PRIMARY KEY (user_id, id)
);
ALTER TABLE public.zoneflow_learning_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own learning history" ON public.zoneflow_learning_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert own learning history" ON public.zoneflow_learning_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own learning history" ON public.zoneflow_learning_history
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.zoneflow_learning_history FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.zoneflow_learning_history TO authenticated;
CREATE INDEX IF NOT EXISTS zoneflow_learning_history_owner_date_idx
  ON public.zoneflow_learning_history (user_id, completed_at DESC);
