-- Support multiple assignees with per-person responsibility on project tasks
CREATE TABLE public.project_task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assignee_email TEXT NOT NULL,
  assignee_name TEXT,
  responsibility TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_task_id, assignee_email)
);

ALTER TABLE public.project_task_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_task_assignments_task_id ON public.project_task_assignments(project_task_id);
CREATE INDEX idx_project_task_assignments_project_id ON public.project_task_assignments(project_id);
CREATE INDEX idx_project_task_assignments_assignee_email ON public.project_task_assignments(assignee_email);

CREATE POLICY "Members can view project task assignments"
ON public.project_task_assignments
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can create project task assignments"
ON public.project_task_assignments
FOR INSERT
TO authenticated
WITH CHECK ((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can update project task assignments"
ON public.project_task_assignments
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid()))
WITH CHECK ((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Members can delete project task assignments"
ON public.project_task_assignments
FOR DELETE
TO authenticated
USING ((user_id = auth.uid()) OR public.is_project_member(project_id, auth.uid()));

CREATE TRIGGER update_project_task_assignments_updated_at
BEFORE UPDATE ON public.project_task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing single-assignee project tasks into the new assignments table
INSERT INTO public.project_task_assignments (
  project_task_id,
  project_id,
  user_id,
  assignee_email,
  assignee_name,
  responsibility,
  created_at,
  updated_at
)
SELECT
  pt.id,
  pt.project_id,
  pt.user_id,
  COALESCE(pt.assigned_email, pm.invited_email),
  COALESCE(pm.invited_display_name, pt.assigned_email),
  NULL,
  COALESCE(pt.created_at, now()),
  COALESCE(pt.updated_at, now())
FROM public.project_tasks pt
LEFT JOIN public.project_members pm ON pm.id = pt.assigned_to
WHERE COALESCE(pt.assigned_email, pm.invited_email) IS NOT NULL
ON CONFLICT (project_task_id, assignee_email) DO NOTHING;