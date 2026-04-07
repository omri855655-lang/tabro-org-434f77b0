
CREATE TABLE public.credit_card_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  encrypted_credentials TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  card_last_digits TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credit card connections"
ON public.credit_card_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_credit_card_connections_updated_at
BEFORE UPDATE ON public.credit_card_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
