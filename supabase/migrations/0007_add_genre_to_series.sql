-- Migration: 0007_add_genre_to_series
-- Adds a genre/demographic column to series for shelf categorization

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS genre TEXT
  DEFAULT 'shonen'
  CHECK (genre IN (
    'shonen', 'shojo', 'seinen', 'josei',
    'fantasy', 'romance', 'horror', 'sci_fi',
    'slice_of_life', 'action', 'comedy', 'other'
  ));

CREATE INDEX IF NOT EXISTS idx_series_genre ON public.series (genre);
