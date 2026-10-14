CREATE OR REPLACE FUNCTION public.record_public_task_submission_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.sent_notifications (
    user_id,
    task_id,
    notification_type,
    channel
  ) VALUES (
    NEW.owner_id,
    NEW.task_id,
    'public_task_submitted',
    'in_app'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_intake_submission_notification
  ON public.task_intake_submissions;

CREATE TRIGGER task_intake_submission_notification
AFTER INSERT ON public.task_intake_submissions
FOR EACH ROW
EXECUTE FUNCTION public.record_public_task_submission_notification();

COMMENT ON FUNCTION public.record_public_task_submission_notification() IS
  'Records an in-app notification whenever a task is accepted through a public intake link.';
