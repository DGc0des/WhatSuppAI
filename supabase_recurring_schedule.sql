-- Add recurring schedule columns to ScheduledSupplements table
ALTER TABLE "ScheduledSupplements"
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) DEFAULT 'once' CHECK (recurrence_type IN ('once', 'daily', 'weekly')),
ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ DEFAULT NULL;

-- Update the unique constraint to allow multiple schedules for recurring events
ALTER TABLE "ScheduledSupplements"
DROP CONSTRAINT IF EXISTS unique_user_supplement_schedule;

-- Add a new constraint that only applies to non-recurring schedules
-- For recurring schedules, we allow duplicates since they represent different occurrences
CREATE UNIQUE INDEX unique_once_schedule
ON "ScheduledSupplements"(user_id, supplement_id, scheduled_date)
WHERE recurrence_type = 'once';

-- Add index for querying by recurrence type
CREATE INDEX idx_scheduled_supplements_recurrence
ON "ScheduledSupplements"(user_id, recurrence_type, scheduled_date);

COMMENT ON COLUMN "ScheduledSupplements".recurrence_type IS 'Type of recurrence: once (one-time), daily (every day), weekly (specific days of week)';
COMMENT ON COLUMN "ScheduledSupplements".recurrence_days IS 'Array of day numbers for weekly recurrence (0=Sunday, 1=Monday, ..., 6=Saturday). NULL for once and daily.';
COMMENT ON COLUMN "ScheduledSupplements".recurrence_end_date IS 'Optional end date for recurring schedules. NULL means no end date.';
