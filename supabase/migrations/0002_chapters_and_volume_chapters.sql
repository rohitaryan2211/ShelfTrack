-- Migration: 0002_chapters_and_volume_chapters
-- Adds chapters and the volume_chapters join table

create table chapters (
  id                   uuid primary key default uuid_generate_v4(),
  series_id            uuid not null references series(id) on delete cascade,
  chapter_number       numeric not null,
  title                text,
  original_release_date date
);

-- Many-to-many: a chapter can appear in multiple volumes (omnibus editions)
create table volume_chapters (
  volume_id  uuid not null references volumes(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  primary key (volume_id, chapter_id)
);
