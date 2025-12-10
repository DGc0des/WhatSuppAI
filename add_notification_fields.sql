-- Add notification fields to ScheduledSupplements table
ALTER TABLE "ScheduledSupplements"
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_timing TEXT DEFAULT 'on-time' CHECK (notification_timing IN ('on-time', '30-min-before', '1-hour-before')),
ADD COLUMN IF NOT EXISTS notification_id TEXT;

-- Add index for efficient querying of enabled notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_supplements_notification_enabled
ON "ScheduledSupplements"(notification_enabled)
WHERE notification_enabled = true;
