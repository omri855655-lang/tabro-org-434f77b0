CREATE OR REPLACE FUNCTION public.share_sheet_with_email(
  _sheet_id uuid,
  _invited_email text,
  _permission text DEFAULT 'view'
)
RETURNS public.task_sheet_collaborators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(trim(_invited_email));
  v_row public.task_sheet_collaborators;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Invalid invited email';
  END IF;

  IF _permission NOT IN ('view', 'edit') THEN
    RAISE EXCEPTION 'Invalid permission';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.task_sheets ts
    WHERE ts.id = _sheet_id
      AND ts.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'No permission to share this sheet';
  END IF;

  INSERT INTO public.task_sheet_collaborators (
    sheet_id,
    invited_email,
    permission,
    invited_by
  )
  VALUES (
    _sheet_id,
    v_email,
    _permission,
    v_actor
  )
  ON CONFLICT (sheet_id, invited_email)
  DO UPDATE SET
    permission = EXCLUDED.permission,
    invited_by = v_actor
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.share_sheet_with_email(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_sheet_with_email(uuid, text, text) TO authenticated;