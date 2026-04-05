
-- Add installment and billing fields to payment_tracking
ALTER TABLE public.payment_tracking
  ADD COLUMN IF NOT EXISTS installment_total integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS installment_number integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_day integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS month_key text DEFAULT to_char(now(), 'YYYY-MM');

-- Add notification settings to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{
    "email_enabled": true,
    "push_enabled": true,
    "telegram_enabled": false,
    "reminder_time": "08:00",
    "max_daily_notifications": 5,
    "salary_prompt_day": 1,
    "salary_prompt_enabled": true,
    "budget_alert_threshold": 80,
    "weekly_summary_enabled": true,
    "weekly_summary_day": 0
  }'::jsonb;

-- Create index for month-based queries
CREATE INDEX IF NOT EXISTS idx_payment_tracking_month_key ON public.payment_tracking (user_id, month_key);
