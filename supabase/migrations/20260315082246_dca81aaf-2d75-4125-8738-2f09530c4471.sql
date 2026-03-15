
-- Add status_changed_at column to books, shows, podcasts, courses
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;
ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;

-- Create trigger function to auto-update status_changed_at when status changes
CREATE OR REPLACE FUNCTION public.update_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Add triggers
CREATE TRIGGER trg_books_status_changed
BEFORE UPDATE ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.update_status_changed_at();

CREATE TRIGGER trg_shows_status_changed
BEFORE UPDATE ON public.shows
FOR EACH ROW
EXECUTE FUNCTION public.update_status_changed_at();

CREATE TRIGGER trg_podcasts_status_changed
BEFORE UPDATE ON public.podcasts
FOR EACH ROW
EXECUTE FUNCTION public.update_status_changed_at();

CREATE TRIGGER trg_courses_status_changed
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_status_changed_at();
