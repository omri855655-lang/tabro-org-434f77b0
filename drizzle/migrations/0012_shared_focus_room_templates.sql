ALTER TABLE public.zoneflow_focus_rooms ADD COLUMN IF NOT EXISTS template_key text UNIQUE;

-- Shared built-in rooms cannot be renamed or privatized by their first visitor.
DROP POLICY IF EXISTS "Owners can update focus rooms" ON public.zoneflow_focus_rooms;
CREATE POLICY "Owners can update focus rooms"
ON public.zoneflow_focus_rooms FOR UPDATE TO authenticated
USING (owner_id = auth.uid() AND template_key IS NULL)
WITH CHECK (owner_id = auth.uid() AND template_key IS NULL);
DROP POLICY IF EXISTS "Users can create focus rooms" ON public.zoneflow_focus_rooms;
CREATE POLICY "Users can create focus rooms"
ON public.zoneflow_focus_rooms FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() AND template_key IS NULL);

CREATE OR REPLACE FUNCTION public.get_or_create_zoneflow_template_room(p_template_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_room uuid; v_name text; v_topic text; v_scene text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT title, topic, scene INTO v_name, v_topic, v_scene
  FROM (VALUES
    ('library', 'Tabro Library', 'Reading quietly', 'library'),
    ('reading-club', 'Reading Hall', 'Books and long-form reading', 'library'),
    ('focus-plane', 'Focus Flight', 'Deep work', 'plane'),
    ('exam-flight', 'Exam Flight', 'Quiet exam preparation', 'plane'),
    ('hebrew-study', 'לומדים ביחד', 'עברית / קריאה', 'cafe'),
    ('study-cafe', 'Study Cafe', 'Light study and planning', 'cafe'),
    ('cowork', 'Tabro Cowork', 'Work sprint', 'office'),
    ('body-double', 'Silent Body Double', 'Quiet accountability', 'office')
  ) AS templates(key, title, topic, scene) WHERE key = p_template_key;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Unknown room template'; END IF;
  INSERT INTO public.zoneflow_focus_rooms(owner_id, name, topic, scene, access, template_key)
  VALUES (auth.uid(), v_name, v_topic, v_scene, 'public', p_template_key)
  ON CONFLICT (template_key) DO UPDATE SET template_key = excluded.template_key
  RETURNING id INTO v_room;
  RETURN v_room;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_zoneflow_template_room(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_zoneflow_template_room(text) TO authenticated;
