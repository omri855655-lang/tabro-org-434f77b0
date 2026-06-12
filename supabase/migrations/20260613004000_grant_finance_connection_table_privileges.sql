-- Allow authenticated users to access finance connection tables while RLS
-- still limits each user to their own rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.credit_card_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_connections TO authenticated;
