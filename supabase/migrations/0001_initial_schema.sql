-- Migration: 0001_initial_schema
-- Consolidated baseline database schema for ShelfTrack

create extension if not exists "uuid-ossp";

-- ─── 1. REGIONS & PUBLISHERS ──────────────────────────────────────────────────
create table if not exists regions (
  code text primary key,          -- ISO 3166-1 alpha-2, e.g. 'US', 'JP', 'GB', 'IN'
  name text not null
);

create table if not exists publishers (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  country               text references regions(code),
  website               text,
  is_original_publisher boolean not null default false
);

-- ─── 2. SERIES & VOLUMES ──────────────────────────────────────────────────────
create table if not exists series (
  id                    uuid primary key default uuid_generate_v4(),
  title                 text not null,
  original_title        text,
  type                  text not null default 'manga'
                          check (type in ('manga', 'novel', 'light_novel')),
  genre                 text check (genre in ('shonen', 'shojo', 'seinen', 'josei', 'fantasy', 'romance', 'horror', 'sci_fi', 'slice_of_life', 'action', 'comedy', 'other')),
  description           text,
  original_publisher_id uuid references publishers(id),
  status                text not null default 'ongoing'
                          check (status in ('ongoing', 'completed', 'hiatus')),
  cover_url             text,
  ingest_status         text not null default 'published'
                          check (ingest_status in ('draft', 'published', 'rejected')),
  created_at            timestamptz not null default now()
);

create table if not exists volumes (
  id            uuid primary key default uuid_generate_v4(),
  series_id     uuid not null references series(id) on delete cascade,
  volume_number numeric not null,
  title         text,
  description   text,
  isbn          text,
  isbn13        text,
  publisher_id  uuid references publishers(id),
  region_code   text references regions(code),
  language_code text not null default 'en',
  edition_type  text not null default 'single'
                  check (edition_type in ('single', 'omnibus', 'deluxe', 'digital_only')),
  release_date  date,
  cover_url     text,
  page_count    int,
  ingest_status text not null default 'published'
                  check (ingest_status in ('draft', 'published', 'rejected')),
  constraint uq_volume_edition unique (series_id, volume_number, region_code)
);

create table if not exists chapters (
  id                    uuid primary key default uuid_generate_v4(),
  series_id             uuid not null references series(id) on delete cascade,
  chapter_number        numeric not null,
  title                 text,
  original_release_date date
);

create table if not exists volume_chapters (
  volume_id  uuid not null references volumes(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  primary key (volume_id, chapter_id)
);

-- ─── 3. RETAILERS & AVAILABILITY ──────────────────────────────────────────────
create table if not exists retailers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  region_code text references regions(code),
  base_url    text
);

create table if not exists volume_availability (
  id               uuid primary key default uuid_generate_v4(),
  volume_id        uuid not null references volumes(id) on delete cascade,
  retailer_id      uuid not null references retailers(id),
  region_code      text not null references regions(code),
  product_url      text,
  in_print         boolean,
  last_verified_at timestamptz
);

-- ─── 4. PROFILES, LIBRARY & CHAPTER READS ────────────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  avatar_url text,
  bio        text,
  created_at timestamptz not null default now()
);

create table if not exists library_entries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  volume_id     uuid references volumes(id) on delete cascade,
  series_id     uuid references series(id) on delete cascade,
  read_status   text not null default 'plan_to_read'
                  check (read_status in ('plan_to_read', 'reading', 'completed', 'dropped', 'on_hold')),
  read_date     date,
  owned         boolean not null default false,
  owned_date    date,
  owned_format  text check (owned_format in ('physical', 'digital', 'both')),
  personal_rating numeric check (personal_rating between 1 and 10),
  updated_at    timestamptz not null default now(),
  constraint uq_user_volume unique (user_id, volume_id),
  constraint uq_user_series unique (user_id, series_id)
);

create table if not exists user_chapter_reads (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  chapter_id  uuid not null references chapters(id) on delete cascade,
  read_format text not null default 'digital'
                check (read_format in ('physical', 'digital', 'scanlation')),
  read_at     timestamptz not null default now(),
  constraint uq_user_chapter unique (user_id, chapter_id)
);

-- ─── 5. REVIEWS & SOCIAL ACTIVITY ──────────────────────────────────────────────
create table if not exists reviews (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  series_id         uuid references series(id) on delete cascade,
  volume_id         uuid references volumes(id) on delete cascade,
  body              text not null,
  rating            numeric check (rating between 1 and 10),
  contains_spoilers boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint chk_review_target check (
    (series_id is not null) != (volume_id is not null)
  )
);

create table if not exists activity_feed (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  event_type   text not null check (event_type in ('completed_volume', 'completed_series', 'chapter_logged', 'review_published')),
  series_id    uuid references series(id) on delete cascade,
  volume_id    uuid references volumes(id) on delete cascade,
  review_id    uuid references reviews(id) on delete cascade,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists activity_likes (
  activity_id  uuid not null references activity_feed(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists activity_comments (
  id           uuid primary key default uuid_generate_v4(),
  activity_id  uuid not null references activity_feed(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  comment      text not null,
  created_at   timestamptz not null default now()
);

-- ─── 6. INDEXES & POPULARITY VIEW ─────────────────────────────────────────────
create index if not exists idx_user_chapter_reads_user on user_chapter_reads(user_id);
create index if not exists idx_user_chapter_reads_chapter on user_chapter_reads(chapter_id);
create index if not exists idx_activity_feed_user on activity_feed(user_id);
create index if not exists idx_activity_feed_created on activity_feed(created_at desc);

create materialized view if not exists volume_popularity as
select
  v.id as volume_id,
  count(*) filter (where le.owned) as owned_count,
  count(*) filter (where le.read_status = 'completed') as read_count,
  avg(le.personal_rating) as avg_rating
from volumes v
left join library_entries le on le.volume_id = v.id
group by v.id;

-- ─── 7. ROW LEVEL SECURITY POLICIES ───────────────────────────────────────────

-- ─── profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "Profiles are publicly readable"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ─── library_entries ──────────────────────────────────────────────────────────
alter table library_entries enable row level security;

create policy "Library entries are publicly readable"
  on library_entries for select using (true);

create policy "Users can insert own library entries"
  on library_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own library entries"
  on library_entries for update using (auth.uid() = user_id);

create policy "Users can delete own library entries"
  on library_entries for delete using (auth.uid() = user_id);

-- ─── reviews ──────────────────────────────────────────────────────────────────
alter table reviews enable row level security;

create policy "Reviews are publicly readable"
  on reviews for select using (true);

create policy "Users can insert own reviews"
  on reviews for insert with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on reviews for update using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on reviews for delete using (auth.uid() = user_id);

-- ─── catalog tables (read-only for everyone, write restricted to curator role) ─
alter table publishers enable row level security;
alter table series enable row level security;
alter table volumes enable row level security;
alter table chapters enable row level security;
alter table volume_chapters enable row level security;
alter table volume_availability enable row level security;
alter table regions enable row level security;
alter table retailers enable row level security;

-- Materialized views do not support RLS; use GRANT for read-only access
grant select on volume_popularity to anon, authenticated;

create policy "Catalog: public read" on publishers for select using (true);
create policy "Catalog: public read" on series for select using (true);
create policy "Catalog: public read" on volumes for select using (true);
create policy "Catalog: public read" on chapters for select using (true);
create policy "Catalog: public read" on volume_chapters for select using (true);
create policy "Catalog: public read" on volume_availability for select using (true);
create policy "Catalog: public read" on regions for select using (true);
create policy "Catalog: public read" on retailers for select using (true);
