-- Fix: Remove unique constraint from image column
-- Multiple supplements can have the same image URL (or no image)
-- Run this in your Supabase SQL Editor

-- 1. Drop the unique constraint on image column
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_image_key";

-- 2. Verify the constraint was removed
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = '"Scanned"'::regclass;
