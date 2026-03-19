DROP FUNCTION IF EXISTS public.is_project_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_project_role(uuid, uuid) CASCADE;

-- Recreate with SECURITY DEFINER
CREATE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id
      AND (user_id = _user_id OR invited_email = (SELECT email FROM auth.users WHERE id = _user_id))
  );
$$;

CREATE FUNCTION public.get_project_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.project_members
  WHERE project_id = _project_id
    AND (user_id = _user_id OR invited_email = (SELECT email FROM auth.users WHERE id = _user_id))
  LIMIT 1;
$$;

-- Recreate all dropped policies
CREATE POLICY "Project owners can manage members"
ON public.project_members
FOR ALL
TO authenticated
USING (invited_by = auth.uid() OR is_project_member(auth.uid(), project_id))
WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Members can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())::text
  OR is_project_member(auth.uid(), project_id)
);

CREATE POLICY "Members can view shared projects"
ON public.projects
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_project_member(auth.uid(), id));

CREATE POLICY "Manager members can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR (is_project_member(auth.uid(), id) AND get_project_role(id, auth.uid()) = 'manager'));

CREATE POLICY "Members can view shared project tasks"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can edit shared project tasks"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Members can create shared project tasks"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR is_project_member(auth.uid(), project_id));