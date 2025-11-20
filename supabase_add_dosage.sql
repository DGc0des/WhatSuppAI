-- Add dosage column to ScheduledSupplements table
ALTER TABLE "ScheduledSupplements"
ADD COLUMN IF NOT EXISTS dosage VARCHAR(100) DEFAULT NULL;

COMMENT ON COLUMN "ScheduledSupplements".dosage IS 'Dosage information for the scheduled supplement (e.g., "2 capsules", "1 tablet", "5ml")';
