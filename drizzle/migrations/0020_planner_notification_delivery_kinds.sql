-- Planner reminders, completion check-ins and morning/deadline pushes now use the same
-- durable per-user/item/channel claim ledger as important-mail alerts.
ALTER TABLE public.notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_kind_check;
ALTER TABLE public.notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
  CHECK (kind IN ('important_mail', 'push_test', 'planner_reminder', 'planner_completion', 'planner_morning', 'planner_deadline'));

-- Supports per-user daily-limit counts of accepted deliveries per channel.
CREATE INDEX IF NOT EXISTS notification_deliveries_user_channel_accepted
  ON public.notification_deliveries (user_id, channel, accepted_at)
  WHERE status = 'accepted';