-- Migration: 0001_init_publishers_series_volumes
-- Creates the core catalog tables: publishers, regions, series, series_licensors, volumes

create extension if not exists "uuid-ossp";

-- ─── regions ──────────────────────────────────────────────────────────────────
create table regions (
  code text primary key,          -- ISO 3166-1 alpha-2, e.g. 'US', 'JP', 'GB'
  name text not null
);

-- ─── publishers ───────────────────────────────────────────────────────────────
create table publishers (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  country             text references regions(code),
  website             text,
  is_original_publisher boolean not null default false
);

-- ─── series ───────────────────────────────────────────────────────────────────
create table series (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  original_title        text,
  type                  text not null default 'manga'
                          check (type in ('manga', 'novel', 'light_novel')),
  description           text,
  original_publisher_id uuid references publishers(id),
  status                text not null default 'ongoing'
                          check (status in ('ongoing', 'completed', 'hiatus')),
  cover_url             text,
  created_at            timestamptz not null default now()
);

-- ─── series_licensors ─────────────────────────────────────────────────────────
create table series_licensors (
  id           uuid primary key default uuid_generate_v4(),
  series_id    uuid not null references series(id) on delete cascade,
  region_code  text not null references regions(code),
  publisher_id uuid not null references publishers(id)
);

-- ─── volumes ──────────────────────────────────────────────────────────────────
create table volumes (
  id            uuid primary key default uuid_generate_v4(),
  series_id     uuid not null references series(id) on delete cascade,
  volume_number numeric not null,
  title         text,
  isbn13        text,
  publisher_id  uuid references publishers(id),
  region_code   text references regions(code),
  release_date  date,
  cover_url     text,
  page_count    int,
  constraint uq_volume_edition unique (series_id, volume_number, region_code)
);
