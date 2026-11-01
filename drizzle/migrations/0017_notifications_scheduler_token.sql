-- Separate server-only token for the existing planner/push notification scheduler.
-- Generated inside the database; the value is never stored in the repository.
INSERT INTO private.scheduler_tokens (name) VALUES ('notifications') ON CONFLICT (name) DO NOTHING;
