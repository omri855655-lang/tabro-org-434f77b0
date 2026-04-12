
-- Enable realtime for calendar events and invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_invitations;

-- Prevent duplicate invitations (same event + same email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_invitations_unique_email
ON public.event_invitations (event_id, lower(invitee_email));

-- Allow invitees to update their own invitation (accept/decline)
CREATE POLICY "Invitees can update their own invitation"
ON public.event_invitations
FOR UPDATE
USING (
  invitee_user_id = auth.uid()
  OR lower(invitee_email) = lower(COALESCE(auth.email(), ''))
)
WITH CHECK (
  invitee_user_id = auth.uid()
  OR lower(invitee_email) = lower(COALESCE(auth.email(), ''))
);

-- Allow invitees to read their own invitations
CREATE POLICY "Invitees can read their own invitations"
ON public.event_invitations
FOR SELECT
USING (
  inviter_user_id = auth.uid()
  OR invitee_user_id = auth.uid()
  OR lower(invitee_email) = lower(COALESCE(auth.email(), ''))
);
