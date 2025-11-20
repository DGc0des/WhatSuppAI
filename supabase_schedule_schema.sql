-- Create ScheduledSupplements table for supplement scheduling
CREATE TABLE IF NOT EXISTS "ScheduledSupplements" (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES "Scanned"(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_supplement_schedule UNIQUE(user_id, supplement_id, scheduled_date)
);

-- Enable RLS on ScheduledSupplements
ALTER TABLE "ScheduledSupplements" ENABLE ROW LEVEL SECURITY;

-- Create policies for ScheduledSupplements
CREATE POLICY "Enable users to view their own scheduled supplements"
ON "ScheduledSupplements"
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Enable users to insert their own scheduled supplements"
ON "ScheduledSupplements"
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable users to update their own scheduled supplements"
ON "ScheduledSupplements"
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable users to delete their own scheduled supplements"
ON "ScheduledSupplements"
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_scheduled_supplements_user_date
ON "ScheduledSupplements"(user_id, scheduled_date);

-- Verify table creation
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'ScheduledSupplements';

-- View all policies on the table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'ScheduledSupplements';
