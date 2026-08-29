ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS text_color TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id
  ON public.tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_text_color_format;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_text_color_format
  CHECK (text_color IS NULL OR text_color ~ '^#[0-9A-Fa-f]{6}$');
