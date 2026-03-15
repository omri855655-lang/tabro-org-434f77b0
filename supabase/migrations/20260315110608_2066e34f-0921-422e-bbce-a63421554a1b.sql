-- Fix RLS policy on task_sheet_collaborators: replace auth.users subquery with auth.email()
DROP POLICY IF EXISTS "Collaborators can view their own entries" ON public.task_sheet_collaborators;
CREATE POLICY "Collaborators can view their own entries"
  ON public.task_sheet_collaborators
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid())
    OR (lower(invited_email) = lower(COALESCE(auth.email(), '')))
  );

-- Fix RLS policy on sharing_activity_log: replace auth.users subquery with auth.email()
DROP POLICY IF EXISTS "Collaborators can view sharing activity" ON public.sharing_activity_log;
CREATE POLICY "Collaborators can view sharing activity"
  ON public.sharing_activity_log
  FOR SELECT TO authenticated
  USING (
    lower(target_email) = lower(COALESCE(auth.email(), ''))
  );

-- Ensure the trigger exists for auto-filling collaborator info
DROP TRIGGER IF EXISTS trg_fill_collaborator_user_id ON public.task_sheet_collaborators;
CREATE TRIGGER trg_fill_collaborator_user_id
  BEFORE INSERT OR UPDATE ON public.task_sheet_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_collaborator_user_id();

-- Ensure the trigger exists for auto-filling task creator info
DROP TRIGGER IF EXISTS trg_fill_task_creator_info ON public.tasks;
CREATE TRIGGER trg_fill_task_creator_info
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_task_creator_info();