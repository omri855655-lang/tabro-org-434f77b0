CREATE TABLE IF NOT EXISTS public.project_task_intake_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS public.project_task_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.project_task_intake_links(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_task_intake_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_task_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage project intake links"
  ON public.project_task_intake_links FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners view project intake submissions"
  ON public.project_task_intake_submissions FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

REVOKE ALL ON public.project_task_intake_links FROM anon;
REVOKE ALL ON public.project_task_intake_submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_task_intake_links TO authenticated;
GRANT SELECT ON public.project_task_intake_submissions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_project_task_intake_link(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_owner_id uuid := auth.uid(); v_token uuid;
BEGIN
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = v_owner_id) THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  INSERT INTO public.project_task_intake_links (owner_id, project_id, enabled)
  VALUES (v_owner_id, p_project_id, true)
  ON CONFLICT (project_id) DO UPDATE SET enabled = true, updated_at = now()
  RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_project_task_intake(p_token text)
RETURNS TABLE (owner_display_name text, project_title text, project_description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(nullif(trim(pr.display_name), ''), nullif(trim(pr.username), ''), 'משתמש Tabro'),
    p.title, p.description
  FROM public.project_task_intake_links l
  JOIN public.projects p ON p.id = l.project_id
  LEFT JOIN public.profiles pr ON pr.user_id = l.owner_id
  WHERE l.enabled AND l.token::text = trim(p_token)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_project_task(
  p_token text,
  p_requester_name text,
  p_requester_email text,
  p_requester_phone text,
  p_title text,
  p_details text,
  p_responsible text,
  p_due_date date,
  p_urgent boolean,
  p_company_website text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.project_task_intake_links%ROWTYPE;
  v_task_id uuid;
  v_email text := lower(nullif(trim(p_requester_email), ''));
  v_name text := nullif(trim(p_requester_name), '');
  v_notes text;
BEGIN
  IF nullif(trim(COALESCE(p_company_website, '')), '') IS NOT NULL THEN RAISE EXCEPTION 'Submission rejected'; END IF;
  SELECT * INTO v_link FROM public.project_task_intake_links
    WHERE enabled AND token::text = trim(p_token) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or disabled intake link'; END IF;
  IF v_name IS NULL OR char_length(v_name) > 120 THEN RAISE EXCEPTION 'Invalid requester name'; END IF;
  IF v_email IS NULL OR char_length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid requester email';
  END IF;
  IF nullif(trim(p_title), '') IS NULL OR char_length(trim(p_title)) > 500 THEN RAISE EXCEPTION 'Invalid task title'; END IF;
  IF char_length(COALESCE(p_details, '')) > 5000 OR char_length(COALESCE(p_responsible, '')) > 120 OR char_length(COALESCE(p_requester_phone, '')) > 60 THEN
    RAISE EXCEPTION 'Submission is too long';
  END IF;
  IF (SELECT count(*) FROM public.project_task_intake_submissions WHERE link_id = v_link.id AND created_at > now() - interval '10 minutes') >= 25 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later';
  END IF;

  v_notes := concat_ws(E'\n', nullif(trim(p_details), ''),
    CASE WHEN nullif(trim(p_responsible), '') IS NOT NULL THEN 'איש קשר / אחראי מוצע: ' || trim(p_responsible) END,
    'נשלח בקישור הפרויקט על ידי ' || v_name || ' (' || v_email || ')',
    CASE WHEN nullif(trim(p_requester_phone), '') IS NOT NULL THEN 'טלפון השולח: ' || trim(p_requester_phone) END);

  INSERT INTO public.project_tasks (project_id, user_id, title, description, notes, due_date, urgent, status, completed, sort_order, started_by_name)
  VALUES (v_link.project_id, v_link.owner_id, trim(p_title), nullif(trim(p_details), ''), v_notes, p_due_date,
    COALESCE(p_urgent, false), 'לא התחיל', false,
    COALESCE((SELECT max(sort_order) + 1 FROM public.project_tasks WHERE project_id = v_link.project_id), 0), v_name)
  RETURNING id INTO v_task_id;

  INSERT INTO public.project_task_intake_submissions (link_id, owner_id, project_task_id, requester_name, requester_email, requester_phone)
  VALUES (v_link.id, v_link.owner_id, v_task_id, v_name, v_email, nullif(trim(p_requester_phone), ''));

  INSERT INTO public.sent_notifications (user_id, task_id, notification_type, channel)
  VALUES (v_link.owner_id, v_task_id, 'project_task_submitted', 'in_app');
  RETURN v_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_project_task_intake_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_project_task_intake(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_project_task(text,text,text,text,text,text,text,date,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_project_task_intake_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_project_task_intake(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_project_task(text,text,text,text,text,text,text,date,boolean,text) TO anon, authenticated;
