
CREATE TABLE public.daily_stopwatch (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0,
  running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  current_date_str TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_stopwatch ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_daily_stopwatch_user ON public.daily_stopwatch(user_id);

CREATE POLICY "Users can view own stopwatch" ON public.daily_stopwatch FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stopwatch" ON public.daily_stopwatch FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stopwatch" ON public.daily_stopwatch FOR UPDATE USING (auth.uid() = user_id);
