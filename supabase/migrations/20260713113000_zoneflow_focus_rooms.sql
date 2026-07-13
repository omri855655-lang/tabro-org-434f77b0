CREATE TABLE IF NOT EXISTS public.zoneflow_focus_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  topic text NOT NULL DEFAULT 'Focus',
  scene text NOT NULL DEFAULT 'library' CHECK (scene IN ('library', 'plane', 'cafe', 'office')),
  access text NOT NULL DEFAULT 'public' CHECK (access IN ('public', 'friends')),
  invite_code text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zoneflow_focus_room_members (
  room_id uuid NOT NULL REFERENCES public.zoneflow_focus_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Tabro member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.zoneflow_focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.zoneflow_focus_rooms(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zoneflow_focus_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoneflow_focus_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoneflow_focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public and owned focus rooms"
ON public.zoneflow_focus_rooms FOR SELECT TO authenticated
USING (
  access = 'public'
  OR owner_id = auth.uid()
);

CREATE POLICY "Users can create focus rooms"
ON public.zoneflow_focus_rooms FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update focus rooms"
ON public.zoneflow_focus_rooms FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view room presence"
ON public.zoneflow_focus_room_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.zoneflow_focus_rooms r
    WHERE r.id = room_id AND (r.access = 'public' OR r.owner_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own presence"
ON public.zoneflow_focus_room_members FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave rooms"
ON public.zoneflow_focus_room_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their focus sessions"
ON public.zoneflow_focus_sessions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.join_zoneflow_focus_room(
  p_room_id uuid,
  p_display_name text DEFAULT 'Tabro member',
  p_invite_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room public.zoneflow_focus_rooms;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_room FROM public.zoneflow_focus_rooms WHERE id = p_room_id AND is_active = true;
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.access = 'friends' AND upper(coalesce(v_room.invite_code, '')) <> upper(coalesce(trim(p_invite_code), '')) AND v_room.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'A valid room code is required';
  END IF;

  INSERT INTO public.zoneflow_focus_room_members (room_id, user_id, display_name, last_seen_at)
  VALUES (v_room.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Tabro member'), now())
  ON CONFLICT (room_id, user_id) DO UPDATE
  SET display_name = excluded.display_name, last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.join_zoneflow_focus_room_by_code(
  p_invite_code text,
  p_display_name text DEFAULT 'Tabro member'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
BEGIN
  SELECT id INTO v_room_id FROM public.zoneflow_focus_rooms
  WHERE upper(invite_code) = upper(trim(p_invite_code)) AND is_active = true;
  IF v_room_id IS NULL THEN RAISE EXCEPTION 'Room code not found'; END IF;
  PERFORM public.join_zoneflow_focus_room(v_room_id, p_display_name, p_invite_code);
  RETURN v_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.zoneflow_focus_room_directory()
RETURNS TABLE (id uuid, name text, topic text, scene text, access text, invite_code text, users bigint, country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.name, r.topic, r.scene, r.access,
    CASE WHEN r.owner_id = auth.uid() OR m_self.user_id IS NOT NULL THEN r.invite_code ELSE NULL END,
    count(m.user_id), 'Global'::text
  FROM public.zoneflow_focus_rooms r
  LEFT JOIN public.zoneflow_focus_room_members m ON m.room_id = r.id AND m.last_seen_at > now() - interval '10 minutes'
  LEFT JOIN public.zoneflow_focus_room_members m_self ON m_self.room_id = r.id AND m_self.user_id = auth.uid()
  WHERE r.is_active = true AND (r.access = 'public' OR r.owner_id = auth.uid() OR m_self.user_id IS NOT NULL)
  GROUP BY r.id, m_self.user_id
  ORDER BY count(m.user_id) DESC, r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.join_zoneflow_focus_room(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_zoneflow_focus_room_by_code(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.zoneflow_focus_room_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_zoneflow_focus_room(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_zoneflow_focus_room_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zoneflow_focus_room_directory() TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.zoneflow_focus_rooms TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.zoneflow_focus_room_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zoneflow_focus_sessions TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.zoneflow_focus_room_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
