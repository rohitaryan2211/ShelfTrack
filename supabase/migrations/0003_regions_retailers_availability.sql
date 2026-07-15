-- Migration: 0003_regions_retailers_availability
-- Adds retailers and volume_availability tables

create table retailers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  region_code text references regions(code),
  base_url    text
);

create table volume_availability (
  id               uuid primary key default uuid_generate_v4(),
  volume_id        uuid not null references volumes(id) on delete cascade,
  retailer_id      uuid not null references retailers(id),
  region_code      text not null references regions(code),
  product_url      text,
  in_print         boolean,
  last_verified_at timestamptz
);
