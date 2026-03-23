
-- Add approval status to project_members
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
-- For new members added by non-owners, status will be 'pending'
-- Owner can approve them by updating to 'approved'

-- Add shopping sharing tables (reuse task_sheet pattern)
CREATE TABLE IF NOT EXISTS public.shopping_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sheet_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shopping_sheet_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id uuid NOT NULL REFERENCES public.shopping_sheets(id) ON DELETE CASCADE,
  user_id uuid,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL,
  permission text NOT NULL DEFAULT 'view',
  invited_display_name text,
  invited_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopping_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_sheet_collaborators ENABLE ROW LEVEL SECURITY;

-- Shopping sheets RLS
CREATE POLICY "Users can manage own shopping sheets" ON public.shopping_sheets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shopping sheet collaborators RLS  
CREATE POLICY "Sheet owners can manage shopping collaborators" ON public.shopping_sheet_collaborators FOR ALL TO public
  USING (invited_by = auth.uid()) WITH CHECK (invited_by = auth.uid());

CREATE POLICY "Collaborators can view own shopping entries" ON public.shopping_sheet_collaborators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lower(invited_email) = lower(COALESCE(auth.email(), '')));

-- Function to check shopping sheet collaboration
CREATE OR REPLACE FUNCTION public.is_shopping_collaborator(_user_id uuid, _sheet_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_sheets ss WHERE ss.id = _sheet_id AND ss.user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.shopping_sheet_collaborators c
    WHERE c.sheet_id = _sheet_id
      AND (c.user_id = _user_id OR lower(c.invited_email) = lower((SELECT email FROM auth.users WHERE id = _user_id)))
  );
$$;

-- Collaborators can view shared shopping sheets
CREATE POLICY "Collaborators can view shared shopping sheets" ON public.shopping_sheets FOR SELECT TO public
  USING (is_shopping_collaborator(auth.uid(), id));

-- Shopping items: collaborators can view/edit shared items
CREATE POLICY "Collaborators can view shared shopping items" ON public.shopping_items FOR SELECT TO public
  USING (sheet_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shopping_sheets ss
    WHERE ss.sheet_name = shopping_items.sheet_name AND ss.user_id = shopping_items.user_id
      AND is_shopping_collaborator(auth.uid(), ss.id)
  ));

CREATE POLICY "Collaborators can edit shared shopping items" ON public.shopping_items FOR UPDATE TO public
  USING (sheet_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shopping_sheets ss
    WHERE ss.sheet_name = shopping_items.sheet_name AND ss.user_id = shopping_items.user_id
      AND is_shopping_collaborator(auth.uid(), ss.id)
  ))
  WITH CHECK (sheet_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shopping_sheets ss
    WHERE ss.sheet_name = shopping_items.sheet_name AND ss.user_id = shopping_items.user_id
      AND is_shopping_collaborator(auth.uid(), ss.id)
  ));

-- Trigger for shopping collaborator auto-fill
CREATE TRIGGER fill_shopping_collaborator_user_id
  BEFORE INSERT OR UPDATE ON public.shopping_sheet_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.fill_collaborator_user_id();

-- Trigger for shopping sheets updated_at
CREATE TRIGGER update_shopping_sheets_updated_at
  BEFORE UPDATE ON public.shopping_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
