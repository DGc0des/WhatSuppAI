-- Fix: Change unique constraint from barcode alone to (barcode, user_id) combination
-- This allows different users to scan the same supplement
-- Run this in your Supabase SQL Editor

-- 1. Drop the old constraint that only checks barcode
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_barcode_key";

-- 2. Create a new unique constraint on (barcode, user_id) combination
-- This allows multiple users to scan the same barcode, but prevents duplicates per user
ALTER TABLE "Scanned" ADD CONSTRAINT "Scanned_barcode_user_unique"
UNIQUE (barcode, user_id);

-- 3. Verify the constraint was created
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = '"Scanned"'::regclass;
