
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'default',
ADD COLUMN IF NOT EXISTS custom_colors jsonb DEFAULT '{}'::jsonb;
