
CREATE TABLE public.checked_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checked_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checked items"
ON public.checked_items FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checked items"
ON public.checked_items FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checked items"
ON public.checked_items FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checked items"
ON public.checked_items FOR DELETE USING (auth.uid() = user_id);
