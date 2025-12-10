-- Safe migration: Scanned -> History and Stack with data preservation
-- Run this in your Supabase SQL Editor

-- 1. Rename current "Scanned" table to "History"
ALTER TABLE "Scanned" RENAME TO "History";

-- 2. Create new "Stack" table
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

-- 5. IMPORTANT: Copy all History items that are currently scheduled to Stack
-- This ensures existing schedules continue to work
INSERT INTO "Stack" (id, user_id, barcode, name, brand, image, analysis, rating, scores, created_at)
SELECT DISTINCT h.id, h.user_id, h.barcode, h.name, h.brand, h.image, h.analysis, h.rating, h.scores, h.created_at
FROM "History" h
INNER JOIN "ScheduledSupplements" s ON s.supplement_id = h.id
ON CONFLICT (barcode, user_id) DO NOTHING;

-- 6. Update the Stack table's ID sequence to avoid conflicts
SELECT setval(pg_get_serial_sequence('"Stack"', 'id'), COALESCE((SELECT MAX(id) FROM "Stack"), 1));

-- 7. Now update the foreign key constraint
ALTER TABLE "ScheduledSupplements" DROP CONSTRAINT IF EXISTS "ScheduledSupplements_supplement_id_fkey";

ALTER TABLE "ScheduledSupplements"
ADD CONSTRAINT "ScheduledSupplements_supplement_id_fkey"
FOREIGN KEY (supplement_id)
REFERENCES "Stack"(id)
ON DELETE CASCADE;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_history_user_id ON "History"(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON "History"(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stack_user_id ON "Stack"(user_id);
CREATE INDEX IF NOT EXISTS idx_stack_created_at ON "Stack"(created_at DESC);

-- 9. Verify migration
SELECT
  'History' as table_name,
  COUNT(*) as row_count
FROM "History"
UNION ALL
SELECT
  'Stack' as table_name,
  COUNT(*) as row_count
FROM "Stack"
UNION ALL
SELECT
  'ScheduledSupplements' as table_name,
  COUNT(*) as row_count
FROM "ScheduledSupplements";
