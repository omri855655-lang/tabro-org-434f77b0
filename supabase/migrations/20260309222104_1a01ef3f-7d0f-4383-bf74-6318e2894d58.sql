
ALTER TABLE public.custom_board_items 
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sheet_name text DEFAULT 'ראשי';
