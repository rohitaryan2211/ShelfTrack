-- RLS: Row Level Security policies
-- Apply AFTER enabling RLS on each table in the Supabase dashboard or via CLI

-- ─── profiles ─────────────────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "Profiles are publicly readable"
  on profiles for select using (true);

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

create policy "Catalog: public read" on publishers for select using (true);
create policy "Catalog: public read" on series for select using (true);
create policy "Catalog: public read" on volumes for select using (true);
create policy "Catalog: public read" on chapters for select using (true);
create policy "Catalog: public read" on volume_chapters for select using (true);
create policy "Catalog: public read" on volume_availability for select using (true);
create policy "Catalog: public read" on regions for select using (true);
create policy "Catalog: public read" on retailers for select using (true);
