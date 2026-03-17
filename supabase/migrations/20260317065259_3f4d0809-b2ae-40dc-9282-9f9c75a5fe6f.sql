ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS last_editor_user_id uuid,
ADD COLUMN IF NOT EXISTS last_editor_email text,
ADD COLUMN IF NOT EXISTS last_editor_name text,
ADD COLUMN IF NOT EXISTS last_editor_username text;

CREATE OR REPLACE FUNCTION public.fill_task_creator_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    NEW.last_editor_user_id := COALESCE(NEW.last_editor_user_id, v_creator_id);
    NEW.last_editor_email := COALESCE(NEW.last_editor_email, NEW.creator_email, v_creator_email);
    NEW.last_editor_name := COALESCE(NEW.last_editor_name, NEW.creator_name, v_profile_name, split_part(COALESCE(v_creator_email, ''), '@', 1));
    NEW.last_editor_username := COALESCE(NEW.last_editor_username, NEW.creator_username, lower(v_profile_username), split_part(COALESCE(v_creator_email, ''), '@', 1));
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fill_task_last_editor_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_editor_id uuid;
  v_profile_name text;
  v_profile_username text;
  v_editor_email text;
BEGIN
  v_editor_id := COALESCE(auth.uid(), NEW.last_editor_user_id, NEW.creator_user_id, NEW.user_id);
  NEW.last_editor_user_id := v_editor_id;

  IF v_editor_id IS NOT NULL THEN
    SELECT lower(email)
    INTO v_editor_email
    FROM auth.users
    WHERE id = v_editor_id
    LIMIT 1;

    SELECT
      nullif(trim(COALESCE(p.display_name, concat_ws(' ', p.first_name, p.last_name))), ''),
      nullif(trim(p.username), '')
    INTO v_profile_name, v_profile_username
    FROM public.profiles p
    WHERE p.user_id = v_editor_id
    LIMIT 1;

    NEW.last_editor_email := COALESCE(v_editor_email, NEW.last_editor_email);
    NEW.last_editor_name := COALESCE(v_profile_name, NEW.last_editor_name, split_part(COALESCE(v_editor_email, ''), '@', 1));
    NEW.last_editor_username := COALESCE(lower(v_profile_username), NEW.last_editor_username, split_part(COALESCE(v_editor_email, ''), '@', 1));
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fill_task_creator_info ON public.tasks;
CREATE TRIGGER trg_fill_task_creator_info
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fill_task_creator_info();

DROP TRIGGER IF EXISTS trg_fill_task_last_editor_info ON public.tasks;
CREATE TRIGGER trg_fill_task_last_editor_info
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fill_task_last_editor_info();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.tasks
SET
  creator_user_id = COALESCE(creator_user_id, user_id),
  creator_email = COALESCE(creator_email, last_editor_email),
  creator_name = COALESCE(creator_name, last_editor_name),
  creator_username = COALESCE(creator_username, last_editor_username),
  last_editor_user_id = COALESCE(last_editor_user_id, creator_user_id, user_id),
  last_editor_email = COALESCE(last_editor_email, creator_email),
  last_editor_name = COALESCE(last_editor_name, creator_name),
  last_editor_username = COALESCE(last_editor_username, creator_username)
WHERE
  creator_user_id IS NULL
  OR last_editor_user_id IS NULL
  OR creator_email IS NULL
  OR last_editor_email IS NULL;