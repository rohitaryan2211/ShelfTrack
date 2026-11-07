# ShelfTrack

> **"MyAnimeList meets Letterboxd, for manga you actually own."**

ShelfTrack is a cataloging and social platform for manga readers — built around the physical and digital **volume** and **chapter** levels, not just the abstract series. It answers three questions that existing trackers don't handle well together:

1. **Have I read this?** — tracked at chapter and volume granularity, across **physical**, **digital**, or **scanlation** sources.
2. **Do I own this?** — a completely separate fact from read status; collecting and reading are decoupled.
3. **Where can I buy it in my country?** — region-aware retailer and licensor info, per volume.

On top of that core tracking layer, ShelfTrack is a community product: ratings, reviews, popularity rankings, and public activity streams — in the spirit of Letterboxd.

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
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ActivityFeed.tsx   # Community social activity stream
│   │       │   ├── AppLayout.tsx
│   │       │   ├── Cards.tsx
│   │       │   └── ProtectedRoute.tsx
│   │       └── routes/               # Organized domain route subdirectories
│   │           ├── admin/            # AdminIngestPage.tsx
│   │           ├── auth/             # LoginPage.tsx, SettingsPage.tsx
│   │           ├── catalog/          # DiscoverPage.tsx, PublishersPage.tsx, PublisherDetailPage.tsx, SearchPage.tsx
│   │           ├── library/          # LibraryPage.tsx
│   │           ├── profile/          # ProfilePage.tsx
│   │           ├── series/           # SeriesDetailPage.tsx
│   │           ├── volume/           # VolumeDetailPage.tsx
│   │           └── HomePage.tsx      # Landing page & global activity stream
│   └── mobile/           # Expo / React Native (Phase 3)
├── packages/
│   ├── shared/           # TypeScript types & versioned Zod schemas (catalog.ts)
│   └── ui/               # Shared design system (Phase 2)
├── data/
│   ├── vetted/           # Hand-curated series JSON files (pushed to DB via scripts)
│   │   └── <series_slug>/
│   │       └── data.json ($version: 2 format with publisher slugs)
│   └── mock_schema_reference.json  # JSON schema reference for data authors
├── scripts/
│   ├── sync/             # Autonomous catalog sync (AniList + MangaDex + MangaUpdates)
│   │   ├── index.ts      # CLI entry: weekly refresh + discovery, run by GitHub Actions
│   │   ├── build.ts      # Combines the three sources into one series bundle
│   │   ├── map.ts        # Pure mapping rules (status, genre, chapters→volumes, licensors)
│   │   ├── db.ts         # Supabase writes (service key; curated data is never overwritten)
│   │   └── sources/      # API clients
│   ├── ingest/           # Manual curation: push data/vetted/ JSON to Supabase
│   └── db/
│       └── clear.ts      # Full/partial database wipe (with 3-second abort window)
├── supabase/
│   └── migrations/       # SQL migrations — consolidated baseline schema (0001_initial_schema.sql)
└── .github/
    └── workflows/        # CI/CD: deploy, weekly catalog sync, Supabase keep-alive
```

---

## Design System

ShelfTrack uses a hand-crafted dark-mode-first design system (no Tailwind) defined in `apps/web/src/index.css`:

- **Color palette**: Sooty charcoal background (`#161715`) with Japanese-inspired accents — vermillion (`#C1401C`) for owned/actions, ink green (`#3E5C3E`) for read status, ochre (`#C99A3C`) for ratings.
- **Typography**: `Shippori Mincho` (headings) + `Zen Kaku Gothic New` (body) from Google Fonts.
- **Glassmorphism cards**, micro-animations, and hover lifts throughout.
- **Layout**: Sidebar nav on desktop, bottom tab bar on mobile (PWA-ready).

---

## Pages & Routes

| Route | Subdirectory Path | Description |
|---|---|---|
| `/` | `routes/HomePage.tsx` | Home / Landing — hero, feature highlights, trending series, community activity |
| `/discover` | `routes/catalog/DiscoverPage.tsx` | Browse the full catalog — responsive series grid with genre & status filters |
| `/publishers` | `routes/catalog/PublishersPage.tsx` | Publisher index — JP originals vs. regional licensors |
| `/publishers/:id` | `routes/catalog/PublisherDetailPage.tsx` | Publisher detail — all series + stats |
| `/series/:id` | `routes/series/SeriesDetailPage.tsx` | **Core page** — hero, read/own tracking, volume grid, reviews, where to buy |
| `/volumes/:id` | `routes/volume/VolumeDetailPage.tsx` | Volume detail — interactive chapter checklist with format picker (physical, digital, scanlation), edition attributes, retailer links |
| `/search` | `routes/catalog/SearchPage.tsx` | Debounced live search across series and publishers |
| `/library` | `routes/library/LibraryPage.tsx` | Authenticated user's shelf — tabs, grid/list toggle, stats |
| `/profile/:username` | `routes/profile/ProfilePage.tsx` | Public user profile — shelf, reviews, activity stream, stats |
| `/settings` | `routes/auth/SettingsPage.tsx` | Profile management, region preference, account settings |
| `/admin/ingest` | `routes/admin/AdminIngestPage.tsx` | Curator-only — draft queue, manual add, availability manager |
| `/login` | `routes/auth/LoginPage.tsx` | Passwordless sign in / sign up with a one-time email code |

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

# 6. Fill the catalog (free public APIs, no keys)
cd ..
pnpm sync             # AniList + MangaDex + MangaUpdates → Supabase
pnpm push             # optional: hand-curated data/vetted/ JSON

# 7. Start the dev server
pnpm dev
```

### Email sign-in codes (one-time Supabase setup)

Sign-in is email-only: the user enters their email, receives a 6-digit code, and types it in.
Supabase's default email templates send a link instead of the code, so change them once:

1. Supabase dashboard → **Authentication → Emails → Templates**.
2. In both **Magic Link** and **Confirm signup**, replace the body with something like:

   ```html
   <h2>Your ShelfTrack code</h2>
   <p>Enter this code to sign in:</p>
   <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p>It expires in 1 hour. If you didn't request it, ignore this email.</p>
   ```
3. **Authentication → Sign In / Providers**: keep **Email** enabled; Google can be disabled.

The built-in Supabase mailer is free but limited to a few emails per hour. If you outgrow it,
plug in any free-tier SMTP provider under **Authentication → Emails → SMTP Settings**.

### Key CLI Commands

From root:
- `pnpm dev`: Start Vite dev server.
- `pnpm build`: Run typechecks and build production web bundle.
- `pnpm push`: Dry run or live push vetted JSON catalog data to Supabase.
- `pnpm data:migrate`: Bulk-migrate legacy `$version: 1` JSON files in `data/vetted/` to `$version: 2`.
- `pnpm sync` / `pnpm sync:dry`: Run the catalog sync (see below).
- `pnpm test`: Unit tests for the sync's mapping rules.

---

## Catalog: fully automatic

The catalog fills and maintains itself from free public APIs — no API keys, no cost:

| Source | Used for |
|---|---|
| [AniList](https://docs.anilist.co) | Which series exist (top popular + trending), titles, synopsis, author, status, popularity, cover |
| [MangaDex](https://api.mangadex.org/docs/) | Exact ID match via its AniList link, demographic (shōnen/seinen…), per-volume covers, chapter → volume mapping |
| [MangaUpdates](https://api.mangaupdates.com) | Original publisher, English licensor and its volume count |

`.github/workflows/catalog-sync.yml` runs every Monday. Each run:
1. Refreshes every tracked series (ongoing ones fully; completed ones monthly).
2. Adds up to 150 new series from AniList's top 300 popular + top 50 trending.
3. Adds new volumes (original + English edition) and chapters. Nothing is deleted, and
   hand-curated series in `data/vetted/` keep their values — the sync only fills blanks.
4. Logs the run to the `sync_runs` table (shown on `/admin/ingest`) and the job summary.

**One-time setup:** add the `SUPABASE_SERVICE_KEY` repository secret (Settings → Secrets and
variables → Actions; `VITE_SUPABASE_URL` is reused for the URL), apply the migrations, then
trigger **Actions → Catalog Sync → Run workflow** once with `max_new` = 300 to backfill.

Run locally:
```bash
pnpm sync:dry -- --only=30013          # fetch One Piece and print it, no DB access
pnpm sync                              # real run using .env
pnpm sync -- --discover=1000 --max-new=500   # bigger backfill
pnpm test                              # mapping unit tests
```

## Manual curation ($version: 2)

Catalog data lives in `data/vetted/<series_slug>/data.json`.
Files use `$version: 2` which replaces environment-dependent database UUIDs with human-readable publisher slugs (`original_publisher_slug`, `publisher_slug`).

```json
{
  "$version": 2,
  "series": {
    "title": "Jujutsu Kaisen",
    "original_publisher_slug": "shueisha",
    "status": "completed"
  },
  "volumes": [
    {
      "volume_number": 1,
      "publisher_slug": "viz_media",
      "region_code": "US",
      "edition_type": "single",
      "language_code": "en",
      "description": null
    }
  ]
}
```

See **[docs/data_ingestion_guide.md](./docs/data_ingestion_guide.md)** for full schema specifications.

---

## Database Schema

Managed via SQL baseline migration in `supabase/migrations/0001_initial_schema.sql`:

- `regions`, `publishers` — Lookup tables for global original & regional licensors.
- `series`, `volumes`, `chapters`, `volume_chapters` — Catalog tables supporting volume variants (`edition_type`, `language_code`, `isbn`, `description`).
- `retailers`, `volume_availability` — Regional bookstore stockists & direct purchase links.
- `profiles`, `library_entries`, `user_chapter_reads` — User shelf tracking, decoupled ownership, chapter-level format tracking (`physical`, `digital`, `scanlation`).
- `reviews`, `activity_feed`, `activity_likes`, `activity_comments` — Social stream, reviews, and community engagement.

---

## Roadmap

| Phase | Scope |
|---|---|
| **0 — Foundation** | Schema, seed data, hosting skeleton |
| **1 — MVP** | Catalog browsing, read/own tracking, chapter format tracking, reviews, regional availability, Web + PWA |
| **2 — Community** | Custom lists, follows, social activity feeds, likes and comments on reviews |
| **3 — Native Mobile** | Expo build, app store release |
| **4 — Novels** | Extend to light novels and novels via the existing `type` field |

---

## License

MIT
