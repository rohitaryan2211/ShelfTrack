-- Migration: 0002_move_reading_status_to_series_only
-- Move read_status tracking from volume level to series level only
-- Volumes now only track ownership (owned, owned_format, owned_date)

-- Step 1: For any volume entries that have read_status, migrate them to series level
INSERT INTO library_entries (user_id, series_id, read_status, read_date, personal_rating, updated_at)
SELECT DISTINCT
  le.user_id,
  v.series_id,
  CASE
    WHEN le.read_status IN ('completed', 'reading', 'on_hold', 'dropped') THEN le.read_status
    ELSE 'plan_to_read'
  END as read_status,
  le.read_date,
  le.personal_rating,
  now()
FROM library_entries le
JOIN volumes v ON le.volume_id = v.id
WHERE le.volume_id IS NOT NULL
  AND le.read_status IS NOT NULL
  AND le.read_status != 'plan_to_read'
  AND NOT EXISTS (
    SELECT 1 FROM library_entries le2
    WHERE le2.user_id = le.user_id
      AND le2.series_id = v.series_id
      AND le2.volume_id IS NULL
  )
ON CONFLICT (user_id, series_id) DO NOTHING;

-- Step 2: Remove the check constraint to allow null read_status
ALTER TABLE library_entries DROP CONSTRAINT IF EXISTS "library_entries_read_status_check";

-- Step 3: Make read_status nullable and remove default for volume-level entries
ALTER TABLE library_entries
  ALTER COLUMN read_status DROP NOT NULL,
  ALTER COLUMN read_status DROP DEFAULT;

-- Step 4: Set read_status to NULL for all volume-level entries
UPDATE library_entries
SET read_status = NULL
WHERE volume_id IS NOT NULL;

-- Step 5: Add back the check constraint but allow NULL
ALTER TABLE library_entries
  ADD CONSTRAINT library_entries_read_status_check
  CHECK (read_status IS NULL OR read_status IN ('plan_to_read', 'reading', 'completed', 'dropped', 'on_hold'));

-- Step 6: Ensure series-level entries have a default read_status
UPDATE library_entries
SET read_status = 'plan_to_read'
WHERE series_id IS NOT NULL
  AND volume_id IS NULL
  AND read_status IS NULL;
