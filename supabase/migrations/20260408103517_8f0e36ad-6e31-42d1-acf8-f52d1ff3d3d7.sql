
-- Create landing_content table for admin-editable landing page text
CREATE TABLE public.landing_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value_he text NOT NULL DEFAULT '',
  value_en text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read landing content (public page)
CREATE POLICY "Anyone can read landing content"
ON public.landing_content
FOR SELECT
USING (true);

-- Only admins can modify landing content
CREATE POLICY "Admins can manage landing content"
ON public.landing_content
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_landing_content_updated_at
BEFORE UPDATE ON public.landing_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default content
INSERT INTO public.landing_content (key, value_he, value_en) VALUES
  ('hero_title', 'נהל את כל החיים שלך במקום אחד', 'Manage Your Entire Life in One Place'),
  ('hero_subtitle', 'משימות, פרויקטים, לו״ז, קניות, פתקים, ספרים, תשלומים, תזונה וסוכן AI חכם — הכל בפלטפורמה אחת', 'Tasks, projects, calendar, shopping, notes, books, payments, nutrition and a smart AI agent — all in one platform'),
  ('cta_text', 'התחל בחינם', 'Start for Free'),
  ('features_title', 'כל מה שצריך, בדיוק במקום אחד', 'Everything You Need, In One Place'),
  ('features_subtitle', '12 מודולים חזקים שעוזרים לך להפוך מחשבות לפעולה', '12 powerful modules that turn thoughts into action');
