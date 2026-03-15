
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_last_name text;
  v_username text;
  v_display_name text;
  v_preferred_language text;
BEGIN
  v_first_name := nullif(trim(NEW.raw_user_meta_data->>'first_name'), '');
  v_last_name := nullif(trim(NEW.raw_user_meta_data->>'last_name'), '');
  v_username := lower(nullif(trim(NEW.raw_user_meta_data->>'username'), ''));
  v_preferred_language := COALESCE(nullif(trim(NEW.raw_user_meta_data->>'preferred_language'), ''), 'he');

  IF v_username IS NULL AND NEW.email IS NOT NULL THEN
    v_username := split_part(lower(NEW.email), '@', 1);
  END IF;

  v_display_name := nullif(trim(concat_ws(' ', v_first_name, v_last_name)), '');

  INSERT INTO public.profiles (user_id, first_name, last_name, username, display_name, preferred_language)
  VALUES (NEW.id, v_first_name, v_last_name, v_username, v_display_name, v_preferred_language)
  ON CONFLICT (user_id) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    preferred_language = COALESCE(EXCLUDED.preferred_language, public.profiles.preferred_language);

  RETURN NEW;
END;
$function$;
