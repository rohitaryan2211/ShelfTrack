-- Migration: 0004_users_library_entries
-- Adds user profiles and the core library_entries table (read/owned split)

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  avatar_url text,
  bio        text,
  created_at timestamptz not null default now()
);

create table library_entries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  volume_id     uuid references volumes(id) on delete cascade,
  series_id     uuid references series(id) on delete cascade,
  -- read status — fully independent of owned
  read_status   text not null default 'plan_to_read'
                  check (read_status in ('plan_to_read', 'reading', 'completed', 'dropped', 'on_hold')),
  read_date     date,
  -- owned — fully independent of read_status
  owned         boolean not null default false,
  owned_date    date,
  owned_format  text check (owned_format in ('physical', 'digital', 'both')),
  -- optional personal rating
  personal_rating numeric check (personal_rating between 1 and 10),
  updated_at    timestamptz not null default now(),
  -- a user has at most one entry per volume (when volume_id is set)
  constraint uq_user_volume unique (user_id, volume_id),
  -- a user has at most one entry per series (for series-level tracking)
  constraint uq_user_series unique (user_id, series_id)
);

-- Popularity materialized view — refreshed on schedule via GitHub Actions cron
create materialized view volume_popularity as
select
  v.id as volume_id,
  count(*) filter (where le.owned) as owned_count,
  count(*) filter (where le.read_status = 'completed') as read_count,
  avg(le.personal_rating) as avg_rating
from volumes v
left join library_entries le on le.volume_id = v.id
group by v.id;
