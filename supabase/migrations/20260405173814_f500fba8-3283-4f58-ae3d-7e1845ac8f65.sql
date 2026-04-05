
CREATE TABLE public.budget_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, category)
);

ALTER TABLE public.budget_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budget targets"
ON public.budget_targets FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_budget_targets_updated_at
BEFORE UPDATE ON public.budget_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
