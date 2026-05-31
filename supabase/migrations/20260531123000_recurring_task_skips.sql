CREATE TABLE IF NOT EXISTS public.recurring_task_skips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_task_id UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  skipped_date DATE NOT NULL DEFAULT CURRENT_DATE,
  skipped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(recurring_task_id, skipped_date)
);

ALTER TABLE public.recurring_task_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring skips"
ON public.recurring_task_skips
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring skips"
ON public.recurring_task_skips
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring skips"
ON public.recurring_task_skips
FOR DELETE
USING (auth.uid() = user_id);
