-- Migration: 0005_reviews
-- Adds reviews table (Letterboxd-style, per series or per volume)

create table reviews (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  series_id         uuid references series(id) on delete cascade,
  volume_id         uuid references volumes(id) on delete cascade,
  body              text not null,
  rating            numeric check (rating between 1 and 10),
  contains_spoilers boolean not null default false,
  created_at        timestamptz not null default now(),
  -- must target either series or volume, not both, not neither
  constraint chk_review_target check (
    (series_id is not null) != (volume_id is not null)
  )
);
