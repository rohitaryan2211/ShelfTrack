-- Migration: Add ingest_status to series and volumes
-- This enables the draft → published → rejected curation workflow
-- for automated ingest scripts, so only curator-approved data goes live.

-- ── series ──────────────────────────────────────────────────
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS ingest_status TEXT
  DEFAULT 'published'                        -- existing rows are already live
  CHECK (ingest_status IN ('draft', 'published', 'rejected'));

-- New rows from automated ingest scripts should default to 'draft'
-- The seed.ts script explicitly passes ingest_status='draft'
-- The curator approves via /admin/ingest page

-- Update the index for performance on the public-facing catalog query
CREATE INDEX IF NOT EXISTS idx_series_ingest_status
  ON public.series (ingest_status);

-- ── volumes ─────────────────────────────────────────────────
ALTER TABLE public.volumes
  ADD COLUMN IF NOT EXISTS ingest_status TEXT
  DEFAULT 'published'
  CHECK (ingest_status IN ('draft', 'published', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_volumes_ingest_status
  ON public.volumes (ingest_status);

-- ── RLS update ───────────────────────────────────────────────
-- Public queries: only show published rows
-- (Enforce this at the query level in the API, not via RLS,
--  so curators with the service key can still see drafts)

-- Catalog public read policy already exists (from 0001_init).
-- No RLS change needed — the app layer filters WHERE ingest_status = 'published'.
-- The admin UI uses the service key which bypasses RLS.
