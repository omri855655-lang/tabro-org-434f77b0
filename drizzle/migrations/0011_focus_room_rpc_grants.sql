-- Revoke explicit default anon grants as well as the PUBLIC role grant.
REVOKE ALL ON FUNCTION public.join_zoneflow_focus_room(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_zoneflow_focus_room_by_code(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.zoneflow_focus_room_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_zoneflow_focus_room(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_zoneflow_focus_room_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zoneflow_focus_room_directory() TO authenticated;