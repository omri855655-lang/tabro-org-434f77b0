-- Custom SQL migration file, put your code below! --
-- Keep legacy rows intact. Gmail upserts require a real, non-partial unique key.
ALTER TABLE public.email_analyses ADD COLUMN IF NOT EXISTS external_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS email_analyses_connection_external_key
  ON public.email_analyses (connection_id, external_message_id);
