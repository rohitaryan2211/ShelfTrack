-- Migration: 0005_reconcile_schema_and_sync_support
--
-- 1. Reconciles the live database with what the app and 0001 expect
--    (the live project drifted: several volume columns and all social tables were missing).
-- 2. Adds what the autonomous catalog sync needs: external source IDs, sync bookkeeping,
--    and the unique keys that make bulk upserts possible.
-- 3. Creates profiles automatically on signup, and writes the activity feed from triggers.
--
-- Every statement is idempotent so this is safe on both a fresh project and the drifted one.

-- ─── 1. Regions needed by non-Japanese originals ──────────────────────────────
insert into regions (code, name) values
  ('KR', 'South Korea'),
  ('CN', 'China'),
  ('TW', 'Taiwan')
on conflict (code) do nothing;

-- ─── 2. Volumes: columns the app reads but the live table lacked ─────────────
alter table volumes add column if not exists description   text;
alter table volumes add column if not exists isbn          text;
alter table volumes add column if not exists language_code text not null default 'en';
alter table volumes add column if not exists edition_type  text not null default 'single';
alter table volumes add column if not exists created_at    timestamptz not null default now();

alter table volumes drop constraint if exists volumes_edition_type_check;
alter table volumes add constraint volumes_edition_type_check
  check (edition_type in ('single', 'omnibus', 'deluxe', 'digital_only'));

update volumes set language_code = 'ja' where region_code = 'JP' and language_code = 'en';

-- ─── 3. Series: external IDs + sync metadata ─────────────────────────────────
alter table series add column if not exists anilist_id      integer;
alter table series add column if not exists mal_id          integer;
alter table series add column if not exists mangadex_id     uuid;
alter table series add column if not exists mangaupdates_id bigint;
alter table series add column if not exists popularity      integer;   -- AniList popularity (members)
alter table series add column if not exists average_score   integer;   -- AniList mean score, 0-100
alter table series add column if not exists volume_count    integer;
alter table series add column if not exists chapter_count   integer;
alter table series add column if not exists start_year      integer;
alter table series add column if not exists genres          text[] not null default '{}';
alter table series add column if not exists source          text not null default 'manual';
alter table series add column if not exists last_synced_at  timestamptz;

create unique index if not exists uq_series_anilist_id  on series(anilist_id)  where anilist_id is not null;
create unique index if not exists uq_series_mangadex_id on series(mangadex_id) where mangadex_id is not null;
create index if not exists idx_series_popularity on series(popularity desc nulls last);
create index if not exists idx_series_title_lower on series(lower(title));

-- ─── 4. Unique keys for bulk upserts ─────────────────────────────────────────
create unique index if not exists uq_chapters_series_number on chapters(series_id, chapter_number);

alter table publishers add column if not exists slug text;
update publishers
   set slug = trim(both '_' from regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'))
 where slug is null;
create unique index if not exists uq_publishers_slug on publishers(slug);

create unique index if not exists uq_series_licensors on series_licensors(series_id, region_code, publisher_id);

-- ─── 5. Fix collection_status check (live copy had NULL inside IN, which lets anything through)
alter table library_entries drop constraint if exists library_entries_collection_status_check;
alter table library_entries add constraint library_entries_collection_status_check
  check (collection_status in ('owned', 'wishlist'));

-- ─── 6. Social + chapter-tracking tables (missing from the live project) ─────
create table if not exists user_chapter_reads (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles(id) on delete cascade,
  chapter_id  uuid not null references chapters(id) on delete cascade,
  read_format text not null default 'digital'
                check (read_format in ('physical', 'digital', 'scanlation')),
  read_at     timestamptz not null default now(),
  constraint uq_user_chapter unique (user_id, chapter_id)
);

create table if not exists activity_feed (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  event_type   text not null check (event_type in ('completed_volume', 'completed_series', 'chapter_logged', 'review_published')),
  series_id    uuid references series(id) on delete cascade,
  volume_id    uuid references volumes(id) on delete cascade,
  review_id    uuid references reviews(id) on delete cascade,
  metadata     jsonb default '{}'::jsonb,
  likes_count  integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table activity_feed add column if not exists likes_count integer not null default 0;

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

create index if not exists idx_user_chapter_reads_user    on user_chapter_reads(user_id);
create index if not exists idx_user_chapter_reads_chapter on user_chapter_reads(chapter_id);
create index if not exists idx_activity_feed_user         on activity_feed(user_id);
create index if not exists idx_activity_feed_created      on activity_feed(created_at desc);
create index if not exists idx_library_entries_user       on library_entries(user_id);
create index if not exists idx_volumes_series             on volumes(series_id);
create index if not exists idx_chapters_series            on chapters(series_id);

-- One review per user per target
create unique index if not exists uq_review_user_series on reviews(user_id, series_id) where series_id is not null;
create unique index if not exists uq_review_user_volume on reviews(user_id, volume_id) where volume_id is not null;

-- ─── 7. Sync run log (public, read-only; written by the sync job with the service key)
create table if not exists sync_runs (
  id              uuid primary key default uuid_generate_v4(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  mode            text not null default 'weekly',
  status          text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  series_checked  integer not null default 0,
  series_added    integer not null default 0,
  series_updated  integer not null default 0,
  volumes_added   integer not null default 0,
  chapters_added  integer not null default 0,
  errors          jsonb not null default '[]'::jsonb
);
create index if not exists idx_sync_runs_started on sync_runs(started_at desc);

-- ─── 8. RLS for the new tables ───────────────────────────────────────────────
alter table user_chapter_reads enable row level security;
alter table activity_feed      enable row level security;
alter table activity_likes     enable row level security;
alter table activity_comments  enable row level security;
alter table sync_runs          enable row level security;

drop policy if exists "Chapter reads are publicly readable" on user_chapter_reads;
drop policy if exists "Users can insert own chapter reads"  on user_chapter_reads;
drop policy if exists "Users can update own chapter reads"  on user_chapter_reads;
drop policy if exists "Users can delete own chapter reads"  on user_chapter_reads;
create policy "Chapter reads are publicly readable" on user_chapter_reads for select using (true);
create policy "Users can insert own chapter reads"  on user_chapter_reads for insert with check ((select auth.uid()) = user_id);
create policy "Users can update own chapter reads"  on user_chapter_reads for update using ((select auth.uid()) = user_id);
create policy "Users can delete own chapter reads"  on user_chapter_reads for delete using ((select auth.uid()) = user_id);

-- Activity rows are written only by triggers (security definer); users can delete their own.
drop policy if exists "Activity is publicly readable"  on activity_feed;
drop policy if exists "Users can delete own activity"  on activity_feed;
create policy "Activity is publicly readable" on activity_feed for select using (true);
create policy "Users can delete own activity" on activity_feed for delete using ((select auth.uid()) = user_id);

drop policy if exists "Likes are publicly readable" on activity_likes;
drop policy if exists "Users can like"              on activity_likes;
drop policy if exists "Users can unlike"            on activity_likes;
create policy "Likes are publicly readable" on activity_likes for select using (true);
create policy "Users can like"              on activity_likes for insert with check ((select auth.uid()) = user_id);
create policy "Users can unlike"            on activity_likes for delete using ((select auth.uid()) = user_id);

drop policy if exists "Comments are publicly readable" on activity_comments;
drop policy if exists "Users can comment"              on activity_comments;
drop policy if exists "Users can delete own comments"  on activity_comments;
create policy "Comments are publicly readable" on activity_comments for select using (true);
create policy "Users can comment"              on activity_comments for insert with check ((select auth.uid()) = user_id);
create policy "Users can delete own comments"  on activity_comments for delete using ((select auth.uid()) = user_id);

drop policy if exists "Sync runs are publicly readable" on sync_runs;
create policy "Sync runs are publicly readable" on sync_runs for select using (true);

-- ─── 9. Auto-create a profile for every new auth user ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  candidate text;
begin
  base_name := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
  if base_name is null or length(base_name) < 3 then
    base_name := 'reader';
  end if;
  base_name := left(base_name, 24);
  candidate := base_name;

  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base_name || '_' || floor(random() * 9000 + 1000)::int;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up before the trigger existed
do $$
declare
  u record;
  base_name text;
  candidate text;
begin
  for u in select id, email from auth.users where id not in (select id from public.profiles) loop
    base_name := regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
    if base_name is null or length(base_name) < 3 then base_name := 'reader'; end if;
    base_name := left(base_name, 24);
    candidate := base_name;
    while exists (select 1 from public.profiles where username = candidate) loop
      candidate := base_name || '_' || floor(random() * 9000 + 1000)::int;
    end loop;
    insert into public.profiles (id, username) values (u.id, candidate) on conflict (id) do nothing;
  end loop;
end;
$$;

-- ─── 10. Activity feed triggers ──────────────────────────────────────────────
create or replace function public.log_review_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_feed (user_id, event_type, series_id, volume_id, review_id)
  values (new.user_id, 'review_published', new.series_id, new.volume_id, new.id);
  return new;
end;
$$;

drop trigger if exists on_review_created on reviews;
create trigger on_review_created
  after insert on reviews
  for each row execute function public.log_review_activity();

create or replace function public.log_library_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.series_id is not null
     and new.read_status = 'completed'
     and (tg_op = 'INSERT' or old.read_status is distinct from 'completed') then
    insert into public.activity_feed (user_id, event_type, series_id)
    values (new.user_id, 'completed_series', new.series_id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_library_entry_changed on library_entries;
create trigger on_library_entry_changed
  after insert or update of read_status on library_entries
  for each row execute function public.log_library_activity();

create or replace function public.sync_activity_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.activity_feed set likes_count = likes_count + 1 where id = new.activity_id;
  elsif tg_op = 'DELETE' then
    update public.activity_feed set likes_count = greatest(likes_count - 1, 0) where id = old.activity_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_activity_like_changed on activity_likes;
create trigger on_activity_like_changed
  after insert or delete on activity_likes
  for each row execute function public.sync_activity_likes_count();

-- ─── 11. Per-series community stats (live, no refresh needed) ────────────────
create or replace view series_stats
with (security_invoker = true) as
select
  s.id as series_id,
  coalesce(r.readers, 0)   as readers,
  coalesce(r.completed, 0) as completed,
  r.avg_rating,
  coalesce(o.owners, 0)    as owners
from series s
left join (
  select series_id,
         count(*) filter (where read_status is not null)  as readers,
         count(*) filter (where read_status = 'completed') as completed,
         round(avg(personal_rating), 1)                    as avg_rating
    from library_entries
   where series_id is not null
   group by series_id
) r on r.series_id = s.id
left join (
  select v.series_id, count(distinct le.user_id) as owners
    from library_entries le
    join volumes v on v.id = le.volume_id
   where le.collection_status = 'owned'
   group by v.series_id
) o on o.series_id = s.id;

grant select on series_stats to anon, authenticated;
