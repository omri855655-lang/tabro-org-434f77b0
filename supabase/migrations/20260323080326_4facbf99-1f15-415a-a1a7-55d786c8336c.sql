
-- Add missing columns to project_members to match the trigger pattern
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS invited_display_name text,
  ADD COLUMN IF NOT EXISTS invited_username text;

-- Create a trigger to auto-fill project member info (similar to fill_collaborator_user_id)
CREATE OR REPLACE FUNCTION public.fill_project_member_user_id()
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
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = NEW.invited_email
    LIMIT 1;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT lower(email) INTO v_auth_email
    FROM auth.users WHERE id = NEW.user_id LIMIT 1;

    IF NEW.invited_email IS NULL THEN
      NEW.invited_email := v_auth_email;
    END IF;

    SELECT
      nullif(trim(COALESCE(p.display_name, concat_ws(' ', p.first_name, p.last_name))), ''),
      nullif(trim(p.username), '')
    INTO v_profile_display_name, v_profile_username
    FROM public.profiles p WHERE p.user_id = NEW.user_id LIMIT 1;

    NEW.invited_display_name := COALESCE(v_profile_display_name, split_part(COALESCE(NEW.invited_email, v_auth_email, ''), '@', 1));
    NEW.invited_username := COALESCE(lower(v_profile_username), split_part(COALESCE(NEW.invited_email, v_auth_email, ''), '@', 1));
  ELSE
    NEW.invited_display_name := COALESCE(NEW.invited_display_name, split_part(COALESCE(NEW.invited_email, ''), '@', 1));
    NEW.invited_username := COALESCE(lower(NEW.invited_username), split_part(COALESCE(NEW.invited_email, ''), '@', 1));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_fill_project_member
  BEFORE INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.fill_project_member_user_id();
