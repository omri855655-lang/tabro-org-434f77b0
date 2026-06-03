
-- 1. Hash PIN codes -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migrate existing 4-digit plain PINs to bcrypt hashes (idempotent: skip already-hashed values)
UPDATE public.profiles
SET pin_code = crypt(pin_code, gen_salt('bf'))
WHERE pin_code IS NOT NULL
  AND pin_code !~ '^\$2[aby]\$';

-- Server-side PIN verify (never returns the hash)
CREATE OR REPLACE FUNCTION public.verify_pin(input_pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored text;
BEGIN
  IF auth.uid() IS NULL OR input_pin IS NULL THEN
    RETURN false;
  END IF;
  SELECT pin_code INTO stored FROM public.profiles WHERE user_id = auth.uid();
  IF stored IS NULL THEN
    RETURN false;
  END IF;
  RETURN stored = crypt(input_pin, stored);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;

-- Server-side PIN set (hashes before storing)
CREATE OR REPLACE FUNCTION public.set_pin(input_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF input_pin IS NULL OR length(input_pin) < 4 THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  UPDATE public.profiles
  SET pin_code = crypt(input_pin, gen_salt('bf')),
      pin_enabled = true,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_pin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pin(text) TO authenticated;

-- 2. Column-level access ------------------------------------------------------
-- profiles: hide pin_code from authenticated readers
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, display_name, pin_enabled, created_at, updated_at,
  first_name, last_name, username, welcome_email_sent,
  preferred_language, theme_id, custom_colors
) ON public.profiles TO authenticated;
-- UPDATE: prevent client from writing pin_code directly; everything else allowed
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  display_name, pin_enabled, first_name, last_name, username,
  welcome_email_sent, preferred_language, theme_id, custom_colors, updated_at
) ON public.profiles TO authenticated;

-- email_connections: hide tokens from clients
REVOKE SELECT ON public.email_connections FROM authenticated;
GRANT SELECT (
  id, user_id, provider, email_address, connected_at, last_sync,
  settings, created_at, updated_at
) ON public.email_connections TO authenticated;

-- credit_card_connections: hide encrypted_credentials from clients
REVOKE SELECT ON public.credit_card_connections FROM authenticated;
GRANT SELECT (
  id, user_id, provider, display_name, card_last_digits, sync_status,
  sync_error, last_sync, created_at, updated_at
) ON public.credit_card_connections TO authenticated;

-- 3. project_members: don't leak other invited emails to non-managers ---------
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
CREATE POLICY "Members can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR lower(invited_email) = lower(COALESCE(auth.email(), ''))
  OR can_manage_project_members(project_id, auth.uid())
);

-- 4. Revoke anon EXECUTE on internal definer helpers -------------------------
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
