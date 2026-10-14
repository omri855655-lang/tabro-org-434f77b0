CREATE OR REPLACE FUNCTION public.get_public_project_gantt(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'owner_display_name', COALESCE(nullif(trim(pr.display_name), ''), nullif(trim(pr.username), ''), 'משתמש Tabro'),
    'project', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'description', p.description,
      'target_date', p.target_date
    ),
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pt.id,
        'title', pt.title,
        'completed', COALESCE(pt.completed, false),
        'urgent', COALESCE(pt.urgent, false),
        'status', pt.status,
        'due_date', pt.due_date,
        'sort_order', COALESCE(pt.sort_order, 0)
      ) ORDER BY COALESCE(pt.sort_order, 0), pt.created_at)
      FROM public.project_tasks pt
      WHERE pt.project_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.project_task_intake_links l
  JOIN public.projects p ON p.id = l.project_id
  LEFT JOIN public.profiles pr ON pr.user_id = l.owner_id
  WHERE l.enabled AND l.token::text = trim(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_project_gantt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_project_gantt(text) TO anon, authenticated;

-- Earlier environments may retain a direct anon grant despite the migration's
-- PUBLIC revoke. The creator RPC must stay authenticated-only.
REVOKE EXECUTE ON FUNCTION public.get_or_create_project_task_intake_link(uuid) FROM anon;

COMMENT ON FUNCTION public.get_public_project_gantt(text) IS
  'Returns a capability-link, read-only project timeline without exposing project membership or private account data.';
