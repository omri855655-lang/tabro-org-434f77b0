-- Improve collaborator linking and shared-sheet authorization logic
CREATE OR REPLACE FUNCTION public.fill_collaborator_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invited_email IS NOT NULL THEN
    NEW.invited_email := lower(trim(NEW.invited_email));
  END IF;

  IF NEW.user_id IS NULL AND NEW.invited_email IS NOT NULL THEN
    SELECT id
    INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = NEW.invited_email
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_collaborator_user_id ON public.task_sheet_collaborators;
CREATE TRIGGER trg_fill_collaborator_user_id
BEFORE INSERT OR UPDATE OF invited_email ON public.task_sheet_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.fill_collaborator_user_id();

CREATE OR REPLACE FUNCTION public.is_sheet_collaborator(_user_id uuid, _sheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.id = _sheet_id
      AND ts.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.task_sheet_collaborators c
    WHERE c.sheet_id = _sheet_id
      AND (
        c.user_id = _user_id
        OR lower(c.invited_email) = lower((SELECT email FROM auth.users WHERE id = _user_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_sheet(_user_id uuid, _sheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.id = _sheet_id
      AND ts.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.task_sheet_collaborators c
    WHERE c.sheet_id = _sheet_id
      AND c.permission = 'edit'
      AND (
        c.user_id = _user_id
        OR lower(c.invited_email) = lower((SELECT email FROM auth.users WHERE id = _user_id))
      )
  );
$$;

DROP POLICY IF EXISTS "Collaborators can view shared tasks" ON public.tasks;
CREATE POLICY "Collaborators can view shared tasks"
ON public.tasks
FOR SELECT
USING (
  task_type = 'work'
  AND sheet_name IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.sheet_name = tasks.sheet_name
      AND ts.task_type = 'work'
      AND ts.user_id = tasks.user_id
      AND public.is_sheet_collaborator(auth.uid(), ts.id)
  )
);

DROP POLICY IF EXISTS "Collaborators can edit shared tasks" ON public.tasks;
CREATE POLICY "Collaborators can edit shared tasks"
ON public.tasks
FOR UPDATE
USING (
  task_type = 'work'
  AND sheet_name IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.sheet_name = tasks.sheet_name
      AND ts.task_type = 'work'
      AND ts.user_id = tasks.user_id
      AND public.can_edit_sheet(auth.uid(), ts.id)
  )
)
WITH CHECK (
  task_type = 'work'
  AND sheet_name IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.sheet_name = tasks.sheet_name
      AND ts.task_type = 'work'
      AND ts.user_id = tasks.user_id
      AND public.can_edit_sheet(auth.uid(), ts.id)
  )
);

DROP POLICY IF EXISTS "Collaborators can insert shared tasks" ON public.tasks;
CREATE POLICY "Collaborators can insert shared tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  task_type = 'work'
  AND sheet_name IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.sheet_name = tasks.sheet_name
      AND ts.task_type = 'work'
      AND ts.user_id = tasks.user_id
      AND public.can_edit_sheet(auth.uid(), ts.id)
  )
);