-- Add taken status and taken_at timestamp to ScheduledSupplements table
ALTER TABLE "ScheduledSupplements"
ADD COLUMN IF NOT EXISTS taken BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP WITH TIME ZONE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_supplements_taken
ON "ScheduledSupplements"(taken, scheduled_date);
