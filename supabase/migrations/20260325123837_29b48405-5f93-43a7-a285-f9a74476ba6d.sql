ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS urgent boolean DEFAULT false;
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS urgent boolean DEFAULT false;