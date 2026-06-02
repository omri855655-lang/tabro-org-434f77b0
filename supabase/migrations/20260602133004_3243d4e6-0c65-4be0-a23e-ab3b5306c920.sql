
-- 1. Fix admin_login_log INSERT policy - only service role can insert
DROP POLICY IF EXISTS "Service role can insert logs" ON public.admin_login_log;
CREATE POLICY "Service role can insert logs"
ON public.admin_login_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. Pin search_path on pgmq helper functions (linter warning)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- 3. Revoke EXECUTE from anon/public on SECURITY DEFINER helper functions
-- (they should only be callable by authenticated users / service role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_project_members(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_role(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_edit_sheet(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sheet_collaborator(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_shopping_collaborator(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;

-- 4. Remove anonymous public read on audio-files bucket
-- Authenticated owner-folder SELECT policy stays in place.
DROP POLICY IF EXISTS "Public can read audio files" ON storage.objects;
