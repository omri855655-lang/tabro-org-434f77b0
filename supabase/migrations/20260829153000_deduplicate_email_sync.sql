ALTER TABLE public.email_analyses
ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_analyses_external_message
ON public.email_analyses(connection_id, external_message_id)
WHERE external_message_id IS NOT NULL;
