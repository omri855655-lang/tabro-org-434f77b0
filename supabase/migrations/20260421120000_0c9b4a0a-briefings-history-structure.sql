-- Normalize richer task/book/show data without breaking existing notes-based flows.

ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS long_summary text;

CREATE TABLE IF NOT EXISTS public.task_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_user_id uuid NOT NULL,
  sheet_name text,
  task_type text NOT NULL,
  action_type text NOT NULL,
  edited_by_user_id uuid,
  edited_by_email text,
  edited_by_name text,
  edited_by_username text,
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_edit_history_task_created_at
  ON public.task_edit_history(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_edit_history_task_user
  ON public.task_edit_history(task_user_id);

ALTER TABLE public.task_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible task edit history"
ON public.task_edit_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_edit_history.task_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.task_sheets ts
          JOIN public.task_sheet_collaborators c
            ON c.sheet_id = ts.id
          WHERE ts.user_id = t.user_id
            AND ts.task_type = t.task_type
            AND ts.sheet_name = COALESCE(t.sheet_name, '')
            AND (
              c.user_id = auth.uid()
              OR lower(c.invited_email) = lower(COALESCE(auth.email(), ''))
            )
        )
      )
  )
);

CREATE TABLE IF NOT EXISTS public.show_episode_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  season_number integer NOT NULL DEFAULT 1,
  episode_number integer NOT NULL DEFAULT 1,
  episode_title text,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_episode_notes_show
  ON public.show_episode_notes(show_id, sort_order, season_number, episode_number);

ALTER TABLE public.show_episode_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own show episode notes"
ON public.show_episode_notes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own show episode notes"
ON public.show_episode_notes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own show episode notes"
ON public.show_episode_notes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own show episode notes"
ON public.show_episode_notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.book_chapter_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  chapter_title text,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_chapter_summaries_book
  ON public.book_chapter_summaries(book_id, sort_order);

ALTER TABLE public.book_chapter_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own book chapter summaries"
ON public.book_chapter_summaries
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own book chapter summaries"
ON public.book_chapter_summaries
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own book chapter summaries"
ON public.book_chapter_summaries
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own book chapter summaries"
ON public.book_chapter_summaries
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_task_edit_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changed jsonb := '{}'::jsonb;
  v_action text := 'updated';
  v_count integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_edit_history (
      task_id,
      task_user_id,
      sheet_name,
      task_type,
      action_type,
      edited_by_user_id,
      edited_by_email,
      edited_by_name,
      edited_by_username,
      changed_fields,
      changed_count
    )
    VALUES (
      NEW.id,
      NEW.user_id,
      NEW.sheet_name,
      NEW.task_type,
      'created',
      NEW.creator_user_id,
      NEW.creator_email,
      NEW.creator_name,
      NEW.creator_username,
      jsonb_build_object(
        'description', jsonb_build_object('to', NEW.description),
        'status', jsonb_build_object('to', NEW.status),
        'sheet_name', jsonb_build_object('to', NEW.sheet_name)
      ),
      3
    );

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_edit_history (
      task_id,
      task_user_id,
      sheet_name,
      task_type,
      action_type,
      edited_by_user_id,
      edited_by_email,
      edited_by_name,
      edited_by_username,
      changed_fields,
      changed_count
    )
    VALUES (
      OLD.id,
      OLD.user_id,
      OLD.sheet_name,
      OLD.task_type,
      'deleted',
      COALESCE(OLD.last_editor_user_id, OLD.creator_user_id, OLD.user_id),
      COALESCE(OLD.last_editor_email, OLD.creator_email),
      COALESCE(OLD.last_editor_name, OLD.creator_name),
      COALESCE(OLD.last_editor_username, OLD.creator_username),
      jsonb_build_object(
        'description', jsonb_build_object('from', OLD.description),
        'status', jsonb_build_object('from', OLD.status)
      ),
      2
    );

    RETURN OLD;
  END IF;

  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_changed := v_changed || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    v_changed := v_changed || jsonb_build_object('category', jsonb_build_object('from', OLD.category, 'to', NEW.category));
  END IF;
  IF NEW.responsible IS DISTINCT FROM OLD.responsible THEN
    v_changed := v_changed || jsonb_build_object('responsible', jsonb_build_object('from', OLD.responsible, 'to', NEW.responsible));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changed := v_changed || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.status_notes IS DISTINCT FROM OLD.status_notes THEN
    v_changed := v_changed || jsonb_build_object('status_notes', jsonb_build_object('from', OLD.status_notes, 'to', NEW.status_notes));
  END IF;
  IF NEW.progress IS DISTINCT FROM OLD.progress THEN
    v_changed := v_changed || jsonb_build_object('progress', jsonb_build_object('from', OLD.progress, 'to', NEW.progress));
  END IF;
  IF NEW.planned_end IS DISTINCT FROM OLD.planned_end THEN
    v_changed := v_changed || jsonb_build_object('planned_end', jsonb_build_object('from', OLD.planned_end, 'to', NEW.planned_end));
  END IF;
  IF NEW.overdue IS DISTINCT FROM OLD.overdue THEN
    v_changed := v_changed || jsonb_build_object('overdue', jsonb_build_object('from', OLD.overdue, 'to', NEW.overdue));
  END IF;
  IF NEW.urgent IS DISTINCT FROM OLD.urgent THEN
    v_changed := v_changed || jsonb_build_object('urgent', jsonb_build_object('from', OLD.urgent, 'to', NEW.urgent));
  END IF;
  IF NEW.archived IS DISTINCT FROM OLD.archived THEN
    v_changed := v_changed || jsonb_build_object('archived', jsonb_build_object('from', OLD.archived, 'to', NEW.archived));
    v_action := CASE WHEN NEW.archived THEN 'archived' ELSE 'restored' END;
  END IF;
  IF NEW.sheet_name IS DISTINCT FROM OLD.sheet_name THEN
    v_changed := v_changed || jsonb_build_object('sheet_name', jsonb_build_object('from', OLD.sheet_name, 'to', NEW.sheet_name));
  END IF;

  v_count := jsonb_object_length(v_changed);
  IF v_count = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.task_edit_history (
    task_id,
    task_user_id,
    sheet_name,
    task_type,
    action_type,
    edited_by_user_id,
    edited_by_email,
    edited_by_name,
    edited_by_username,
    changed_fields,
    changed_count
  )
  VALUES (
    NEW.id,
    NEW.user_id,
    NEW.sheet_name,
    NEW.task_type,
    v_action,
    COALESCE(NEW.last_editor_user_id, OLD.last_editor_user_id, NEW.creator_user_id, NEW.user_id),
    COALESCE(NEW.last_editor_email, OLD.last_editor_email, NEW.creator_email, OLD.creator_email),
    COALESCE(NEW.last_editor_name, OLD.last_editor_name, NEW.creator_name, OLD.creator_name),
    COALESCE(NEW.last_editor_username, OLD.last_editor_username, NEW.creator_username, OLD.creator_username),
    v_changed,
    v_count
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_task_edit_history_insert ON public.tasks;
CREATE TRIGGER trg_log_task_edit_history_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_edit_history();

DROP TRIGGER IF EXISTS trg_log_task_edit_history_update ON public.tasks;
CREATE TRIGGER trg_log_task_edit_history_update
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_edit_history();

DROP TRIGGER IF EXISTS trg_log_task_edit_history_delete ON public.tasks;
CREATE TRIGGER trg_log_task_edit_history_delete
BEFORE DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_task_edit_history();

DROP TRIGGER IF EXISTS trg_show_episode_notes_updated_at ON public.show_episode_notes;
CREATE TRIGGER trg_show_episode_notes_updated_at
BEFORE UPDATE ON public.show_episode_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_book_chapter_summaries_updated_at ON public.book_chapter_summaries;
CREATE TRIGGER trg_book_chapter_summaries_updated_at
BEFORE UPDATE ON public.book_chapter_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
