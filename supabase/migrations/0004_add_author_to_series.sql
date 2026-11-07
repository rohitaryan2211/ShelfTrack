-- Migration: 0004_add_author_to_series
-- Add author field to series table to track manga/novel authors

ALTER TABLE series
  ADD COLUMN IF NOT EXISTS author TEXT;
