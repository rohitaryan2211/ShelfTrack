-- Migration: 0003_add_collection_status_to_volumes
-- Add wishlist functionality to volume tracking.
-- Volume-level entries use collection_status ('owned' | 'wishlist') instead of the owned boolean.
-- Safe to re-run: the check constraint is dropped and recreated by name.

-- Step 1: Add the collection_status column (nullable; only used by volume-level entries)
ALTER TABLE library_entries
  ADD COLUMN IF NOT EXISTS collection_status TEXT;

-- Step 2: Constrain allowed values. NULL is permitted implicitly by CHECK semantics.
-- (Do not put NULL inside the IN list: `x IN ('a', NULL)` evaluates to NULL for any
-- other value, which makes the CHECK pass and lets invalid values through.)
ALTER TABLE library_entries
  DROP CONSTRAINT IF EXISTS library_entries_collection_status_check;

ALTER TABLE library_entries
  ADD CONSTRAINT library_entries_collection_status_check
  CHECK (collection_status IN ('owned', 'wishlist'));

-- Step 3: Migrate existing owned=true volume entries to collection_status='owned'
UPDATE library_entries
SET collection_status = 'owned'
WHERE volume_id IS NOT NULL
  AND owned = true
  AND collection_status IS NULL;

-- Note: owned, owned_date and owned_format are kept for backward compatibility.
-- The app keeps `owned` in sync with collection_status = 'owned', so the
-- volume_popularity materialized view (which counts le.owned) stays correct.
