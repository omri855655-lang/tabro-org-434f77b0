
-- Restore critical triggers that are missing

-- 1. handle_new_user trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. fill_task_creator_info on tasks INSERT
CREATE OR REPLACE TRIGGER trg_fill_task_creator
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fill_task_creator_info();

-- 3. fill_task_last_editor_info on tasks UPDATE
CREATE OR REPLACE TRIGGER trg_fill_task_editor
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.fill_task_last_editor_info();

-- 4. fill_collaborator_user_id on task_sheet_collaborators
CREATE OR REPLACE TRIGGER trg_fill_collaborator
  BEFORE INSERT OR UPDATE ON public.task_sheet_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.fill_collaborator_user_id();

-- 5. update_updated_at on various tables
CREATE OR REPLACE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. update_status_changed_at for shows, books, podcasts, courses
CREATE OR REPLACE TRIGGER trg_shows_status
  BEFORE UPDATE ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.update_status_changed_at();

CREATE OR REPLACE TRIGGER trg_books_status
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.update_status_changed_at();

CREATE OR REPLACE TRIGGER trg_podcasts_status
  BEFORE UPDATE ON public.podcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_status_changed_at();

CREATE OR REPLACE TRIGGER trg_courses_status
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_status_changed_at();
