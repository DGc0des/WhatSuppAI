-- Fix for Scanned table RLS policies
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on Scanned table
ALTER TABLE "Scanned" ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to start fresh)
DROP POLICY IF EXISTS "Users can view their own scanned supplements" ON "Scanned";
DROP POLICY IF EXISTS "Users can insert their own scanned supplements" ON "Scanned";
DROP POLICY IF EXISTS "Users can update their own scanned supplements" ON "Scanned";
DROP POLICY IF EXISTS "Users can delete their own scanned supplements" ON "Scanned";

-- 3. Create SELECT policy (users can read their own data)
CREATE POLICY "Users can view their own scanned supplements"
ON "Scanned"
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Create INSERT policy (users can insert their own data)
CREATE POLICY "Users can insert their own scanned supplements"
ON "Scanned"
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Create UPDATE policy (users can update their own data)
CREATE POLICY "Users can update their own scanned supplements"
ON "Scanned"
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Create DELETE policy (users can delete their own data)
CREATE POLICY "Users can delete their own scanned supplements"
ON "Scanned"
FOR DELETE
USING (auth.uid() = user_id);

-- 7. Verify policies were created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'Scanned';
