-- Missing columns the app already references
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS text_color text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS long_summary text;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks (parent_task_id);

-- Financial accounts (legacy finance store)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_account_id text,
  provider_name text,
  account_type text,
  display_name text,
  masked_number text,
  currency text,
  current_balance numeric,
  available_balance numeric,
  last_synced_at timestamptz,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own financial accounts" ON public.financial_accounts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Book chapter summaries
CREATE TABLE IF NOT EXISTS public.book_chapter_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_title text,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_chapter_summaries TO authenticated;
GRANT ALL ON public.book_chapter_summaries TO service_role;
ALTER TABLE public.book_chapter_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own book chapter summaries" ON public.book_chapter_summaries
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Show episode notes
CREATE TABLE IF NOT EXISTS public.show_episode_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_number integer,
  episode_number integer,
  episode_title text,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.show_episode_notes TO authenticated;
GRANT ALL ON public.show_episode_notes TO service_role;
ALTER TABLE public.show_episode_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own show episode notes" ON public.show_episode_notes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Task edit history
CREATE TABLE IF NOT EXISTS public.task_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'update',
  changed_count integer NOT NULL DEFAULT 0,
  changed_fields jsonb,
  edited_by_email text,
  edited_by_name text,
  edited_by_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_edit_history_task ON public.task_edit_history (task_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_edit_history TO authenticated;
GRANT ALL ON public.task_edit_history TO service_role;
ALTER TABLE public.task_edit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own task edit history" ON public.task_edit_history
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Recurring task one-off skips
CREATE TABLE IF NOT EXISTS public.recurring_task_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id uuid NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skipped_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_task_id, skipped_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_task_skips TO authenticated;
GRANT ALL ON public.recurring_task_skips TO service_role;
ALTER TABLE public.recurring_task_skips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring task skips" ON public.recurring_task_skips
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());