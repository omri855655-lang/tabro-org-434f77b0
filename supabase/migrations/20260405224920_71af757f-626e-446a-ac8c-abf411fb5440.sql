
-- Add rich fields to project_tasks
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS instructions text,
ADD COLUMN IF NOT EXISTS viewed_by jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS started_by_name text;

-- Create project_milestones table
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  status text DEFAULT 'pending',
  suggested_assignees jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project milestones"
ON public.project_milestones FOR ALL
TO authenticated
USING (auth.uid() = user_id OR is_project_member(project_id, auth.uid()))
WITH CHECK (auth.uid() = user_id OR is_project_member(project_id, auth.uid()));

CREATE TRIGGER update_project_milestones_updated_at
BEFORE UPDATE ON public.project_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create project_task_ai_history table
CREATE TABLE IF NOT EXISTS public.project_task_ai_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_task_ai_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own task AI history"
ON public.project_task_ai_history FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_project_task_ai_history_updated_at
BEFORE UPDATE ON public.project_task_ai_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
