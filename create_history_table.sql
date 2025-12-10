-- Create separate History and Stack tables
-- History: All scanned items (auto-added when scanning)
-- Stack: User's curated supplement stack (manually added from history)
-- Run this in your Supabase SQL Editor

-- 1. Rename current "Scanned" table to "History"
ALTER TABLE "Scanned" RENAME TO "History";

-- 2. Create new "Stack" table for user's curated supplements
CREATE TABLE IF NOT EXISTS "Stack" (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barcode VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  image TEXT,
  analysis TEXT,
  rating INTEGER,
  scores JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "Stack_barcode_user_unique" UNIQUE (barcode, user_id)
);

-- 3. Enable RLS on Stack table
ALTER TABLE "Stack" ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for Stack table
CREATE POLICY "Users can view their own stack"
ON "Stack"
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stack items"
ON "Stack"
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stack items"
ON "Stack"
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stack items"
ON "Stack"
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Update ScheduledSupplements to reference Stack instead of Scanned
-- First, drop the old foreign key
ALTER TABLE "ScheduledSupplements" DROP CONSTRAINT IF EXISTS "ScheduledSupplements_supplement_id_fkey";

-- Add new foreign key to Stack table
ALTER TABLE "ScheduledSupplements"
ADD CONSTRAINT "ScheduledSupplements_supplement_id_fkey"
FOREIGN KEY (supplement_id)
REFERENCES "Stack"(id)
ON DELETE CASCADE;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_history_user_id ON "History"(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON "History"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stack_user_id ON "Stack"(user_id);
CREATE INDEX IF NOT EXISTS idx_stack_created_at ON "Stack"(created_at DESC);

-- 7. Verify tables and constraints
SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE tablename IN ('History', 'Stack')
ORDER BY tablename;
