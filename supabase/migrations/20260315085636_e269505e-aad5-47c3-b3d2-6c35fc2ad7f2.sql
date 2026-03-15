-- 1) Profiles fields for richer identity + welcome email flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS welcome_email_sent boolean NOT NULL DEFAULT false;

-- Keep usernames normalized when present
UPDATE public.profiles
SET username = lower(trim(username))
WHERE username IS NOT NULL;

-- 2) Extend profile bootstrap on new signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_username text;
  v_display_name text;
BEGIN
  v_first_name := nullif(trim(NEW.raw_user_meta_data->>'first_name'), '');
  v_last_name := nullif(trim(NEW.raw_user_meta_data->>'last_name'), '');
  v_username := lower(nullif(trim(NEW.raw_user_meta_data->>'username'), ''));

  IF v_username IS NULL AND NEW.email IS NOT NULL THEN
    v_username := split_part(lower(NEW.email), '@', 1);
  END IF;

  v_display_name := nullif(trim(concat_ws(' ', v_first_name, v_last_name)), '');

  INSERT INTO public.profiles (user_id, first_name, last_name, username, display_name)
  VALUES (NEW.id, v_first_name, v_last_name, v_username, v_display_name)
  ON CONFLICT (user_id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name);

  RETURN NEW;
END;
$$;

-- 3) Strengthen collaborators table with snapshot identity and dedupe protection
ALTER TABLE public.task_sheet_collaborators
  ADD COLUMN IF NOT EXISTS invited_display_name text,
  ADD COLUMN IF NOT EXISTS invited_username text;

-- Normalize existing emails first
UPDATE public.task_sheet_collaborators
SET invited_email = lower(trim(invited_email))
WHERE invited_email IS NOT NULL;

-- Remove duplicate collaborator rows (same sheet + email), keep newest
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY sheet_id, lower(invited_email)
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.task_sheet_collaborators
)
DELETE FROM public.task_sheet_collaborators c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS task_sheet_collaborators_sheet_email_uq
ON public.task_sheet_collaborators (sheet_id, invited_email);

CREATE OR REPLACE FUNCTION public.fill_collaborator_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_display_name text;
  v_profile_username text;
  v_auth_email text;
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

  IF NEW.user_id IS NOT NULL THEN
    SELECT lower(email)
    INTO v_auth_email
    FROM auth.users
    WHERE id = NEW.user_id
    LIMIT 1;

    IF NEW.invited_email IS NULL THEN
      NEW.invited_email := v_auth_email;
    END IF;

    SELECT
      nullif(trim(COALESCE(p.display_name, concat_ws(' ', p.first_name, p.last_name))), ''),
      nullif(trim(p.username), '')
    INTO v_profile_display_name, v_profile_username
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1;

    NEW.invited_display_name := COALESCE(v_profile_display_name, split_part(COALESCE(NEW.invited_email, v_auth_email, ''), '@', 1));
    NEW.invited_username := COALESCE(lower(v_profile_username), split_part(COALESCE(NEW.invited_email, v_auth_email, ''), '@', 1));
  ELSE
    NEW.invited_display_name := COALESCE(NEW.invited_display_name, split_part(COALESCE(NEW.invited_email, ''), '@', 1));
    NEW.invited_username := COALESCE(lower(NEW.invited_username), split_part(COALESCE(NEW.invited_email, ''), '@', 1));
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure only one trigger runs this logic
DROP TRIGGER IF EXISTS fill_sheet_collab_user_id ON public.task_sheet_collaborators;
DROP TRIGGER IF EXISTS trg_fill_collaborator_user_id ON public.task_sheet_collaborators;

CREATE TRIGGER trg_fill_collaborator_user_id
BEFORE INSERT OR UPDATE OF invited_email, user_id
ON public.task_sheet_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.fill_collaborator_user_id();

-- Refresh snapshots for existing rows
UPDATE public.task_sheet_collaborators c
SET
  invited_email = c.invited_email,
  user_id = c.user_id;

-- 4) Improve collaborator select policy (case-insensitive email fallback)
DROP POLICY IF EXISTS "Collaborators can view their own entries" ON public.task_sheet_collaborators;
CREATE POLICY "Collaborators can view their own entries"
ON public.task_sheet_collaborators
FOR SELECT
USING (
  user_id = auth.uid()
  OR lower(invited_email) = lower(COALESCE((SELECT users.email FROM auth.users users WHERE users.id = auth.uid()), ''))
);

-- 5) Track task creator identity for shared sheets transparency
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS creator_user_id uuid,
  ADD COLUMN IF NOT EXISTS creator_email text,
  ADD COLUMN IF NOT EXISTS creator_name text,
  ADD COLUMN IF NOT EXISTS creator_username text;

CREATE OR REPLACE FUNCTION public.fill_task_creator_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_creator_id uuid;
  v_profile_name text;
  v_profile_username text;
  v_creator_email text;
BEGIN
  v_creator_id := COALESCE(NEW.creator_user_id, auth.uid(), NEW.user_id);
  NEW.creator_user_id := v_creator_id;

  IF v_creator_id IS NOT NULL THEN
    SELECT lower(email)
    INTO v_creator_email
    FROM auth.users
    WHERE id = v_creator_id
    LIMIT 1;

    SELECT
      nullif(trim(COALESCE(p.display_name, concat_ws(' ', p.first_name, p.last_name))), ''),
      nullif(trim(p.username), '')
    INTO v_profile_name, v_profile_username
    FROM public.profiles p
    WHERE p.user_id = v_creator_id
    LIMIT 1;

    NEW.creator_email := COALESCE(NEW.creator_email, v_creator_email);
    NEW.creator_name := COALESCE(NEW.creator_name, v_profile_name, split_part(COALESCE(v_creator_email, ''), '@', 1));
    NEW.creator_username := COALESCE(NEW.creator_username, lower(v_profile_username), split_part(COALESCE(v_creator_email, ''), '@', 1));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_task_creator_info ON public.tasks;
CREATE TRIGGER trg_fill_task_creator_info
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fill_task_creator_info();

-- Backfill existing tasks
UPDATE public.tasks t
SET creator_user_id = COALESCE(t.creator_user_id, t.user_id)
WHERE t.creator_user_id IS NULL;

UPDATE public.tasks t
SET creator_email = COALESCE(t.creator_email, lower(u.email))
FROM auth.users u
WHERE u.id = t.creator_user_id
  AND t.creator_email IS NULL;

UPDATE public.tasks t
SET
  creator_name = COALESCE(
    t.creator_name,
    nullif(trim(COALESCE(p.display_name, concat_ws(' ', p.first_name, p.last_name))), ''),
    split_part(COALESCE(t.creator_email, ''), '@', 1)
  ),
  creator_username = COALESCE(
    t.creator_username,
    lower(nullif(trim(p.username), '')),
    split_part(COALESCE(t.creator_email, ''), '@', 1)
  )
FROM public.profiles p
WHERE p.user_id = t.creator_user_id;

UPDATE public.tasks
SET
  creator_name = COALESCE(creator_name, split_part(COALESCE(creator_email, ''), '@', 1)),
  creator_username = COALESCE(creator_username, split_part(COALESCE(creator_email, ''), '@', 1))
WHERE creator_name IS NULL OR creator_username IS NULL;