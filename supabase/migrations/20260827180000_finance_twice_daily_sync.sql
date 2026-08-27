-- Existing cloud connections keep their credentials and data; only the due interval changes.
UPDATE public.bank_connections
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{sync_interval_minutes}',
  '720'::jsonb,
  true
)
WHERE integration_provider = 'cloud_scraper'
  AND COALESCE((metadata->>'sync_interval_minutes')::integer, 360) <> 720;
