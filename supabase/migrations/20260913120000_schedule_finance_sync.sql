CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'finance_cron_secret'
  ) THEN
    RAISE EXCEPTION 'Vault secret finance_cron_secret must be configured before this migration';
  END IF;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'sync-due-finance-connections';

SELECT cron.schedule(
  'sync-due-finance-connections',
  '7 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://qfcuyrdxaambvppduslo.supabase.co/functions/v1/finance-sync-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'finance_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 125000
  );
  $cron$
);
