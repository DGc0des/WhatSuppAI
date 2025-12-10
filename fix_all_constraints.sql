-- Comprehensive fix: Remove all problematic unique constraints from Scanned table
-- Only keep constraints that make sense for a multi-user app
-- Run this in your Supabase SQL Editor

-- 1. Drop all old unique constraints that don't make sense
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_barcode_key";
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_image_key";
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_name_key";
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_brand_key";
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_analysis_key";

-- 2. Ensure we have the correct constraint: unique per (barcode, user_id)
-- This allows multiple users to scan the same supplement
ALTER TABLE "Scanned" DROP CONSTRAINT IF EXISTS "Scanned_barcode_user_unique";
ALTER TABLE "Scanned" ADD CONSTRAINT "Scanned_barcode_user_unique"
UNIQUE (barcode, user_id);

-- 3. Verify final constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = '"Scanned"'::regclass
ORDER BY conname;
