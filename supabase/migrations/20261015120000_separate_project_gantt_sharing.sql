ALTER TABLE public.project_task_intake_links
  ADD COLUMN IF NOT EXISTS gantt_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS gantt_enabled boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS project_gantt_token_unique
  ON public.project_task_intake_links (gantt_token);

CREATE OR REPLACE FUNCTION public.get_or_create_project_gantt_link(p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_owner uuid := auth.uid(); v_token uuid;
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = v_owner) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  INSERT INTO public.project_task_intake_links (owner_id, project_id, gantt_enabled)
  VALUES (v_owner, p_project_id, true)
  ON CONFLICT (project_id) DO UPDATE SET gantt_enabled = true, updated_at = now()
  RETURNING gantt_token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_project_gantt_link(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.project_task_intake_links
  SET gantt_enabled = false, gantt_token = gen_random_uuid(), updated_at = now()
  WHERE project_id = p_project_id AND owner_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_project_gantt(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'owner_display_name', COALESCE(nullif(trim(pr.display_name), ''), nullif(trim(pr.username), ''), 'Tabro'),
    'project', jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'target_date', p.target_date),
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pt.id, 'title', pt.title, 'completed', COALESCE(pt.completed, false),
        'urgent', COALESCE(pt.urgent, false), 'status', pt.status,
        'due_date', pt.due_date, 'sort_order', COALESCE(pt.sort_order, 0)
      ) ORDER BY COALESCE(pt.sort_order, 0), pt.created_at)
      FROM public.project_tasks pt WHERE pt.project_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.project_task_intake_links l
  JOIN public.projects p ON p.id = l.project_id
  LEFT JOIN public.profiles pr ON pr.user_id = l.owner_id
  WHERE l.gantt_enabled AND l.gantt_token::text = trim(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_project_gantt_link(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disable_project_gantt_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_project_gantt_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_project_gantt_link(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_project_gantt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_project_gantt(text) TO anon, authenticated;
