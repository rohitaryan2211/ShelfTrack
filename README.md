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
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages |
| Mobile (Phase 3) | Expo / React Native + PWA |
| CI/CD | GitHub Actions |

---

## Monorepo Structure

```
shelftrack/
├── apps/
│   ├── web/          # React + Vite → Cloudflare Pages
│   └── mobile/       # Expo / React Native (Phase 3)
├── packages/
│   ├── shared/       # TypeScript types, Zod schemas, Supabase query functions
│   └── ui/           # Shared design system (Phase 2)
├── supabase/
│   ├── migrations/   # SQL migrations — the source of truth for the schema
│   ├── seed/         # Starter catalog (Shueisha / Kodansha flagship series)
│   └── policies/     # Row Level Security policies
└── .github/
    └── workflows/    # CI/CD: deploy, keep-alive, mobile builds
```

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
cp apps/web/.env.example apps/web/.env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project

# 4. Apply the database schema
supabase link --project-ref <your-ref>
supabase db push
supabase db seed

# 5. Start the dev server
pnpm dev
```

---

## Roadmap

| Phase | Scope |
|---|---|
| **0 — Foundation** | Schema, seed data for ~10 Shueisha/Kodansha series, hosting skeleton |
| **1 — MVP** | Catalog browsing, read/own tracking, reviews, popularity rankings, regional availability, Web + PWA |
| **2 — Community** | Custom lists, follows, activity feed, likes and comments on reviews |
| **3 — Native Mobile** | Expo build, app store release |
| **4 — Novels** | Extend to light novels and novels via the existing `type` field |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

MIT
