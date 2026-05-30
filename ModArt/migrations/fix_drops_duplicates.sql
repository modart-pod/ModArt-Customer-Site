-- Fix duplicate drops: keep only the latest row per drop_number
-- Run this once in Supabase SQL editor

-- 1. Delete duplicates, keeping the row with the highest created_at per drop_number
DELETE FROM drops
WHERE id NOT IN (
  SELECT DISTINCT ON (drop_number) id
  FROM drops
  ORDER BY drop_number, created_at DESC
);

-- 2. Add unique constraint on drop_number to prevent future duplicates
ALTER TABLE drops
  DROP CONSTRAINT IF EXISTS drops_drop_number_key;

ALTER TABLE drops
  ADD CONSTRAINT drops_drop_number_key UNIQUE (drop_number);
