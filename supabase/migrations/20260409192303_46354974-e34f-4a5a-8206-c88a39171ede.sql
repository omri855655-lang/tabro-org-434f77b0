
-- Event invitations table
CREATE TABLE public.event_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter can see their sent invitations
CREATE POLICY "Inviters can view sent invitations"
ON public.event_invitations FOR SELECT
TO authenticated
USING (inviter_user_id = auth.uid());

-- Invitees can see invitations sent to them
CREATE POLICY "Invitees can view received invitations"
ON public.event_invitations FOR SELECT
TO authenticated
USING (
  invitee_user_id = auth.uid()
  OR lower(invitee_email) = lower(COALESCE(auth.email(), ''))
);

-- Users can create invitations for their own events
CREATE POLICY "Users can create invitations for own events"
ON public.event_invitations FOR INSERT
TO authenticated
WITH CHECK (
  inviter_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.calendar_events WHERE id = event_id AND user_id = auth.uid())
);

-- Inviters can update/delete their invitations
CREATE POLICY "Inviters can update own invitations"
ON public.event_invitations FOR UPDATE
TO authenticated
USING (inviter_user_id = auth.uid());

-- Invitees can update status (accept/decline)
CREATE POLICY "Invitees can respond to invitations"
ON public.event_invitations FOR UPDATE
TO authenticated
USING (
  invitee_user_id = auth.uid()
  OR lower(invitee_email) = lower(COALESCE(auth.email(), ''))
);

CREATE POLICY "Inviters can delete own invitations"
ON public.event_invitations FOR DELETE
TO authenticated
USING (inviter_user_id = auth.uid());

-- Add reminder_time to recurring_tasks
ALTER TABLE public.recurring_tasks ADD COLUMN reminder_time TEXT DEFAULT NULL;

-- Trigger for updated_at on event_invitations
CREATE TRIGGER update_event_invitations_updated_at
BEFORE UPDATE ON public.event_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
