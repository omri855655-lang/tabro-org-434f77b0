ALTER TABLE public.custom_boards
  ADD COLUMN board_type text NOT NULL DEFAULT 'list' CHECK (board_type IN ('list', 'tasks')),
  ADD COLUMN task_items_migrated boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.sync_custom_board_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tasks
    WHERE user_id = OLD.user_id AND task_type = 'personal'
      AND sheet_name = 'tabro-board-' || OLD.id::text;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.task_items_migrated := false;
    RETURN NEW;
  END IF;

  NEW.task_items_migrated := OLD.task_items_migrated;
  IF NEW.board_type = 'tasks' AND OLD.board_type = 'list' AND NOT OLD.task_items_migrated THEN
    INSERT INTO public.tasks (
      user_id, task_type, sheet_name, description, category, status,
      status_notes, archived, created_at, updated_at
    )
    SELECT OLD.user_id, 'personal', 'tabro-board-' || OLD.id::text,
      item.title, item.category,
      CASE
        WHEN lower(btrim(item.status)) IN ('בוצע', 'הושלם', 'סיום', 'done', 'complete', 'completed', 'completado', '完成', '已完成', 'مكتمل', 'تم', 'выполнено', 'готово') THEN 'בוצע'
        WHEN lower(btrim(item.status)) IN ('בטיפול', 'בתהליך', 'בביצוע', 'in progress', 'doing', 'en progreso', '进行中', 'قيد التنفيذ', 'в процессе') THEN 'בטיפול'
        ELSE 'טרם החל'
      END,
      item.notes, item.archived, item.created_at, item.updated_at
    FROM public.custom_board_items AS item
    WHERE item.board_id = OLD.id AND item.user_id = OLD.user_id;
    NEW.task_items_migrated := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_custom_board_type() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_custom_board_type
BEFORE INSERT OR UPDATE OR DELETE ON public.custom_boards
FOR EACH ROW EXECUTE FUNCTION public.sync_custom_board_type();
