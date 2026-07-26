# ShelfTrack

> **"MyAnimeList meets Letterboxd, for manga you actually own."**

ShelfTrack is a cataloging and social platform for manga readers — built around the physical and digital **volume**, not just the abstract series. It answers three questions that existing trackers don't handle well together:

1. **Have I read this?** — tracked at chapter and volume granularity, however you read it.
2. **Do I own this?** — a completely separate fact from read status; collecting and reading are decoupled.
3. **Where can I buy it in my country?** — region-aware retailer and licensor info, per volume.

On top of that core tracking layer, ShelfTrack is a community product: ratings, reviews, popularity rankings, and (in later phases) profiles, lists, and follows — in the spirit of Letterboxd.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Vanilla CSS (design system via CSS variables, no Tailwind) |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages |
| Mobile (Phase 3) | Expo / React Native + PWA |
| CI/CD | GitHub Actions |

---

## Monorepo Structure

```
shelftrack/
├── apps/
│   ├── web/              # React + Vite → Cloudflare Pages
│   └── mobile/           # Expo / React Native (Phase 3)
├── packages/
│   ├── shared/           # TypeScript types, Zod schemas, Supabase query functions
│   └── ui/               # Shared design system (Phase 2)
├── data/
│   ├── vetted/           # Hand-curated series JSON files (pushed to DB via scripts)
│   │   └── <series_slug>/
│   │       └── data.json
│   └── mock_schema_reference.json  # JSON schema reference for data authors
├── scripts/
│   ├── ingest/           # Data ingestion: download, transform, upsert, push
│   │   ├── push.ts       # Main push script: reads data/vetted/ → upserts to Supabase
│   │   ├── download.ts   # Downloads cover images from external URLs
│   │   ├── seed.ts       # One-shot bulk seed from AniList/MangaUpdates/Google Books
│   │   ├── update.ts     # Weekly delta updater (run by GitHub Actions cron)
│   │   ├── upsert.ts     # Supabase upsert helpers (bypasses RLS via service key)
│   │   ├── transform.ts  # Maps API responses → our DB schema
│   │   ├── fix_region.ts # One-off region code fixer utility
│   │   └── sources/
│   │       ├── jikan.ts         # Jikan (MyAnimeList) API client
│   │       ├── mangadex.ts      # MangaDex API client
│   │       ├── mangaupdates.ts  # MangaUpdates REST client
│   │       └── googlebooks.ts   # Google Books API client (ISBN lookup)
│   └── db/
│       └── clear.ts      # Full/partial database wipe (with 3-second abort window)
├── supabase/
│   ├── migrations/       # SQL migrations — source of truth for the DB schema
│   ├── seed/             # Starter catalog seed SQL
│   └── policies/         # Row Level Security policies
└── .github/
    └── workflows/        # CI/CD: deploy, weekly ingest cron
```

---

## Design System

ShelfTrack uses a hand-crafted dark-mode-first design system (no Tailwind) defined in `apps/web/src/index.css`:

- **Color palette**: Sooty charcoal background (`#161715`) with Japanese-inspired accents — vermillion (`#C1401C`) for owned/actions, ink green (`#3E5C3E`) for read status, ochre (`#C99A3C`) for ratings.
- **Typography**: `Shippori Mincho` (headings) + `Zen Kaku Gothic New` (body) from Google Fonts.
- **Glassmorphism cards**, micro-animations, and hover lifts throughout.
- **Layout**: Sidebar nav on desktop, bottom tab bar on mobile (PWA-ready).

---

## Pages (Phase 1 MVP)

| Route | Description |
|---|---|
| `/` | Home / Landing — hero, feature highlights, trending series |
| `/discover` | Browse the full catalog — responsive series grid with genre & status filters |
| `/publishers` | Publisher index — JP originals vs. regional licensors |
| `/publishers/:id` | Publisher detail — all series + stats |
| `/series/:id` | **Core page** — hero, read/own tracking, volumes grid, reviews, where to buy |
| `/volumes/:id` | Volume detail — chapters, retailer links, per-volume tracking |
| `/search` | Debounced live search across series and publishers |
| `/library` | Authenticated user's shelf — tabs, grid/list toggle, stats |
| `/profile/:username` | Public user profile — shelf, reviews, stats |
| `/settings` | Profile management, region preference, account deletion |
| `/admin/ingest` | Curator-only — draft queue, manual add, availability manager |
| `/login` | Sign in / sign up via Supabase Auth |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/shelftrack.git
cd shelftrack

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY

# 4. Apply the database schema
supabase link --project-ref <your-ref>
supabase db push

# 5. Seed regions and publishers (required before any data push)
cd scripts
pnpm run seed:regions
pnpm run seed:publishers

# 6. Push catalog data
pnpm run push         # reads data/vetted/ → pushes to Supabase

# 7. Start the dev server (from root)
cd ..
pnpm dev
```

### Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `SUPABASE_URL` | `.env` (root) | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `.env` (root) | Public anon key (for frontend) |
| `SUPABASE_SERVICE_KEY` | `.env` (root) | Service role key (scripts only — bypasses RLS) |
| `VITE_SUPABASE_URL` | `apps/web/.env.local` | Same URL, Vite-prefixed for the frontend |
| `VITE_SUPABASE_ANON_KEY` | `apps/web/.env.local` | Same anon key, Vite-prefixed |

> **Warning**: Never commit `.env` or any file containing `SUPABASE_SERVICE_KEY`. The service role key has full DB access and bypasses Row Level Security.

---

## Data Ingestion

Catalog data (series, volumes, chapters, publishers) lives in `data/vetted/`. Each series has its own subdirectory with a `data.json` file.

```
data/vetted/
└── jujutsu_kaisen/
    └── data.json       # Series + volumes metadata
```

See **[docs/data_ingestion_guide.md](./docs/data_ingestion_guide.md)** for the full specification of the JSON schema and all ingestion commands.

### Quick push workflow

```bash
cd scripts

# Dry run — see what would be pushed without writing to DB
pnpm tsx ingest/push.ts --dry-run

# Live push — upsert data/vetted/ into Supabase
pnpm tsx ingest/push.ts
```

---

## Database Schema

Managed via SQL migrations in `supabase/migrations/`:

| Migration | Description |
|---|---|
| `0001` | Core tables: `publishers`, `series`, `volumes` |
| `0002` | `chapters` and `volume_chapters` join table |
| `0003` | `regions`, `retailers`, `volume_availability` |
| `0004` | `profiles`, `library_entries` (user tracking) |
| `0005` | `reviews` |
| `0006` | `ingest_status` column on series + volumes |
| `0007` | `genre` column on series |

---

## Roadmap

| Phase | Scope |
|---|---|
| **0 — Foundation** | Schema, seed data, hosting skeleton |
| **1 — MVP** | Catalog browsing, read/own tracking, reviews, regional availability, Web + PWA |
| **2 — Community** | Custom lists, follows, activity feed, likes and comments on reviews |
| **3 — Native Mobile** | Expo build, app store release |
| **4 — Novels** | Extend to light novels and novels via the existing `type` field |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

MIT
