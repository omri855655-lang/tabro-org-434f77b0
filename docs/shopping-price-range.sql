-- Additive rollout; existing prices and ownership policies are unchanged.
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS price_max numeric;
ALTER TABLE public.shopping_items ADD CONSTRAINT shopping_items_price_range_check
CHECK (price_max IS NULL OR (price IS NOT NULL AND price >= 0 AND price_max >= price AND price_max <= 1000000000000));
