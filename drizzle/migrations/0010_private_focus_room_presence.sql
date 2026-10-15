-- Room presence must have the same membership boundary as the room itself.
-- Definer scope is deliberate: friends can join by code without SELECT access
-- to the room row, but still need their own membership checked for Realtime.
CREATE OR REPLACE FUNCTION public.is_zoneflow_room_member(p_topic text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.zoneflow_focus_room_members m
    JOIN public.zoneflow_focus_rooms r ON r.id = m.room_id
    WHERE m.user_id = auth.uid() AND r.is_active
      AND p_topic = 'zoneflow-room-' || m.room_id::text
  );
$$;
REVOKE ALL ON FUNCTION public.is_zoneflow_room_member(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_zoneflow_room_member(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_zoneflow_room_presence(p_room_id uuid, p_online boolean DEFAULT true)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  UPDATE public.zoneflow_focus_room_members
  SET last_seen_at = CASE WHEN p_online THEN now() ELSE now() - interval '11 minutes' END
  WHERE user_id = auth.uid() AND room_id = p_room_id;
$$;
REVOKE ALL ON FUNCTION public.update_zoneflow_room_presence(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_zoneflow_room_presence(uuid, boolean) TO authenticated;

CREATE POLICY "Focus room members receive private realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (
  extension IN ('broadcast', 'presence')
  AND public.is_zoneflow_room_member((SELECT realtime.topic()))
);

CREATE POLICY "Focus room members send private realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  extension IN ('broadcast', 'presence')
  AND public.is_zoneflow_room_member((SELECT realtime.topic()))
);