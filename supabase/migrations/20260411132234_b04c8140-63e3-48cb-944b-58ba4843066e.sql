
-- Allow invitees to view calendar events they've been invited to
CREATE POLICY "Invitees can view events they are invited to"
ON public.calendar_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_invitations ei
    WHERE ei.event_id = calendar_events.id
    AND (
      ei.invitee_user_id = auth.uid()
      OR lower(ei.invitee_email) = lower(COALESCE(auth.email(), ''))
    )
  )
);
