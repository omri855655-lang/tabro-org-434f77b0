CREATE TABLE IF NOT EXISTS public.task_intake_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  task_type text NOT NULL CHECK (task_type IN ('personal', 'work')),
  sheet_name text NOT NULL DEFAULT 'ראשי',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, task_type, sheet_name)
);

CREATE TABLE IF NOT EXISTS public.task_intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.task_intake_links(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text,
  contact_name text,
  contact_email text,
  contact_phone text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_intake_submissions_link_created
  ON public.task_intake_submissions (link_id, created_at DESC);

ALTER TABLE public.task_intake_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_intake_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DROP POLICY IF EXISTS "Owners manage task intake links" ON public.task_intake_links;
CREATE POLICY "Owners manage task intake links"
  ON public.task_intake_links
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners view task intake submissions" ON public.task_intake_submissions;
CREATE POLICY "Owners view task intake submissions"
  ON public.task_intake_submissions
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners delete task intake submissions" ON public.task_intake_submissions;
CREATE POLICY "Owners delete task intake submissions"
  ON public.task_intake_submissions
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

REVOKE ALL ON public.task_intake_links FROM anon;
REVOKE ALL ON public.task_intake_submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_intake_links TO authenticated;
GRANT SELECT, DELETE ON public.task_intake_submissions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_task_intake_link(
  p_task_type text,
  p_sheet_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_token uuid;
  v_sheet_name text := nullif(trim(p_sheet_name), '');
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_task_type NOT IN ('personal', 'work') THEN
    RAISE EXCEPTION 'Invalid task type';
  END IF;
  IF v_sheet_name IS NULL OR char_length(v_sheet_name) > 120 THEN
    RAISE EXCEPTION 'Invalid sheet name';
  END IF;

  INSERT INTO public.task_intake_links (owner_id, task_type, sheet_name, enabled)
  VALUES (v_owner_id, p_task_type, v_sheet_name, true)
  ON CONFLICT (owner_id, task_type, sheet_name)
  DO UPDATE SET enabled = true, updated_at = now()
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_task_intake(p_token text)
RETURNS TABLE (
  owner_display_name text,
  task_type text,
  sheet_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(
      nullif(trim(p.display_name), ''),
      nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(trim(p.username), ''),
      'משתמש Tabro'
    ),
    l.task_type,
    l.sheet_name
  FROM public.task_intake_links l
  LEFT JOIN public.profiles p ON p.user_id = l.owner_id
  WHERE l.enabled
    AND l.token::text = trim(p_token)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_task_intake(
  p_token text,
  p_requester_name text,
  p_requester_email text,
  p_requester_phone text,
  p_description text,
  p_category text,
  p_responsible text,
  p_details text,
  p_progress text,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_planned_end date,
  p_urgent boolean,
  p_company_website text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.task_intake_links%ROWTYPE;
  v_task_id uuid;
  v_requester_name text := nullif(trim(p_requester_name), '');
  v_requester_email text := lower(nullif(trim(p_requester_email), ''));
  v_notes text;
BEGIN
  IF nullif(trim(COALESCE(p_company_website, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Submission rejected';
  END IF;

  SELECT * INTO v_link
  FROM public.task_intake_links
  WHERE enabled AND token::text = trim(p_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or disabled intake link';
  END IF;
  IF v_requester_name IS NULL OR char_length(v_requester_name) > 120 THEN
    RAISE EXCEPTION 'Invalid requester name';
  END IF;
  IF v_requester_email IS NULL
    OR char_length(v_requester_email) > 254
    OR v_requester_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid requester email';
  END IF;
  IF nullif(trim(p_description), '') IS NULL OR char_length(trim(p_description)) > 500 THEN
    RAISE EXCEPTION 'Invalid task description';
  END IF;
  IF char_length(COALESCE(p_details, '')) > 5000
    OR char_length(COALESCE(p_progress, '')) > 2000
    OR char_length(COALESCE(p_requester_phone, '')) > 60
    OR char_length(COALESCE(p_contact_name, '')) > 120
    OR char_length(COALESCE(p_contact_email, '')) > 254
    OR char_length(COALESCE(p_contact_phone, '')) > 60 THEN
    RAISE EXCEPTION 'Submission is too long';
  END IF;
  IF p_contact_email IS NOT NULL
    AND nullif(trim(p_contact_email), '') IS NOT NULL
    AND lower(trim(p_contact_email)) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid contact email';
  END IF;

  IF (SELECT count(*) FROM public.task_intake_submissions
      WHERE link_id = v_link.id AND created_at > now() - interval '10 minutes') >= 25 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later';
  END IF;
  IF (SELECT count(*) FROM public.task_intake_submissions
      WHERE link_id = v_link.id
        AND requester_email = v_requester_email
        AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later';
  END IF;

  v_notes := concat_ws(E'\n',
    nullif(trim(p_details), ''),
    CASE WHEN nullif(trim(p_contact_name), '') IS NOT NULL THEN 'איש קשר: ' || trim(p_contact_name) END,
    CASE WHEN nullif(trim(p_contact_email), '') IS NOT NULL THEN 'אימייל איש קשר: ' || lower(trim(p_contact_email)) END,
    CASE WHEN nullif(trim(p_contact_phone), '') IS NOT NULL THEN 'טלפון איש קשר: ' || trim(p_contact_phone) END,
    'נשלח בקישור הציבורי על ידי ' || v_requester_name || ' (' || v_requester_email || ')',
    CASE WHEN nullif(trim(p_requester_phone), '') IS NOT NULL THEN 'טלפון השולח: ' || trim(p_requester_phone) END
  );

  INSERT INTO public.tasks (
    user_id, description, category, responsible, status, status_notes, progress,
    planned_end, overdue, urgent, task_type, sheet_name, archived,
    creator_email, creator_name, creator_username
  ) VALUES (
    v_link.owner_id,
    trim(p_description),
    nullif(trim(p_category), ''),
    nullif(trim(p_responsible), ''),
    'טרם החל',
    v_notes,
    nullif(trim(p_progress), ''),
    p_planned_end,
    false,
    COALESCE(p_urgent, false),
    v_link.task_type,
    v_link.sheet_name,
    false,
    v_requester_email,
    v_requester_name,
    split_part(v_requester_email, '@', 1)
  ) RETURNING id INTO v_task_id;

  INSERT INTO public.task_intake_submissions (
    link_id, owner_id, task_id, requester_name, requester_email, requester_phone,
    contact_name, contact_email, contact_phone, details
  ) VALUES (
    v_link.id, v_link.owner_id, v_task_id, v_requester_name, v_requester_email,
    nullif(trim(p_requester_phone), ''), nullif(trim(p_contact_name), ''),
    lower(nullif(trim(p_contact_email), '')), nullif(trim(p_contact_phone), ''),
    nullif(trim(p_details), '')
  );

  RETURN v_task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_task_intake_link(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_task_intake(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_task_intake(text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_task_intake_link(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_task_intake(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_task_intake(text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, text) TO anon, authenticated;