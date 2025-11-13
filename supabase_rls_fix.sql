-- Fix RLS for Scanned table
-- This ensures users can only view and modify their own supplement data

-- 1. Enable RLS on the table (this is the critical step!)
ALTER TABLE "Scanned" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to recreate them with correct configuration
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON "Scanned";
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON "Scanned";
DROP POLICY IF EXISTS "Enable users to view their own data only" ON "Scanned";

-- 3. Recreate SELECT policy (view own data)
CREATE POLICY "Enable users to view their own data only"
ON "Scanned"
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Recreate INSERT policy (create own data)
CREATE POLICY "Enable insert for users based on user_id"
ON "Scanned"
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Add UPDATE policy (update own data - this was missing!)
CREATE POLICY "Enable update for users based on user_id"
ON "Scanned"
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Recreate DELETE policy (delete own data)
CREATE POLICY "Enable delete for users based on user_id"
ON "Scanned"
FOR DELETE
USING (auth.uid() = user_id);

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'Scanned';

-- View all policies on the table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'Scanned';
