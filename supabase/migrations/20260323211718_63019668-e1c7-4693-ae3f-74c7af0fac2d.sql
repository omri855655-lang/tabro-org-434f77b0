
-- Shopping Lists table
CREATE TABLE public.shopping_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  category text,
  quantity text,
  price numeric,
  status text NOT NULL DEFAULT 'לקנות',
  notes text,
  sheet_name text NOT NULL DEFAULT 'ראשי',
  priority text DEFAULT 'רגיל',
  is_dream boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own shopping items" ON public.shopping_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payment Tracking table
CREATE TABLE public.payment_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  category text,
  payment_type text NOT NULL DEFAULT 'expense',
  payment_method text,
  due_date date,
  paid boolean NOT NULL DEFAULT false,
  recurring boolean NOT NULL DEFAULT false,
  recurring_frequency text,
  notes text,
  sheet_name text NOT NULL DEFAULT 'ראשי',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payments" ON public.payment_tracking FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Dream Goals table
CREATE TABLE public.dream_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'חלום',
  progress integer NOT NULL DEFAULT 0,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_roadmap jsonb,
  notes text,
  category text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dream_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dream goals" ON public.dream_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nutrition Tracking table
CREATE TABLE public.nutrition_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL DEFAULT 'ארוחת בוקר',
  food_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  calories integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nutrition" ON public.nutrition_tracking FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User health profile for nutrition AI
CREATE TABLE public.health_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  age integer,
  weight numeric,
  height numeric,
  gender text,
  activity_level text DEFAULT 'moderate',
  dietary_preferences jsonb DEFAULT '[]'::jsonb,
  allergies jsonb DEFAULT '[]'::jsonb,
  health_goals text,
  ethnicity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own health profile" ON public.health_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_shopping_items_updated_at BEFORE UPDATE ON public.shopping_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_tracking_updated_at BEFORE UPDATE ON public.payment_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dream_goals_updated_at BEFORE UPDATE ON public.dream_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_tracking_updated_at BEFORE UPDATE ON public.nutrition_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_profiles_updated_at BEFORE UPDATE ON public.health_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
