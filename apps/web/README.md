# ShelfTrack — Web App (`apps/web`)

The React + Vite frontend for ShelfTrack. Deployed to Cloudflare Pages.

---

## Stack

| | |
|---|---|
| Framework | React 19 + Vite 8 |
| Language | TypeScript ~6 |
| Styling | Vanilla CSS (custom design system in `src/index.css`) |
| Auth + DB | Supabase (`@supabase/supabase-js`) |
| Routing | React Router v7 |
| Icons | Lucide React |

---

## Project Structure

```
apps/web/src/
├── components/
│   ├── ActivityFeed.tsx    # Live community activity stream & social likes
│   ├── AppLayout.tsx       # Sidebar + bottom nav shell, auth-aware
│   ├── Cards.tsx           # SeriesCard, VolumeCard, SkeletonCard
│   └── ProtectedRoute.tsx  # Auth guard wrapper
├── hooks/
│   └── useAuth.tsx         # Supabase Auth context + hook
├── lib/
│   ├── supabaseClient.ts   # Supabase client (uses VITE_ env vars)
│   ├── types.ts            # TypeScript interfaces mirroring DB schema
│   └── regionLabels.ts     # Human-readable region code labels
├── routes/                 # Organized domain route subdirectories
│   ├── admin/
│   │   └── AdminIngestPage.tsx  # /admin/ingest — Curator draft queue & forms
│   ├── auth/
│   │   ├── LoginPage.tsx        # /login — Passwordless Magic Link & Google OAuth sign in / sign up
│   │   └── SettingsPage.tsx     # /settings — Account & preference settings
│   ├── catalog/
│   │   ├── DiscoverPage.tsx     # /discover — Responsive series grid & filters
│   │   ├── PublishersPage.tsx   # /publishers — Original & licensor publishers
│   │   ├── PublisherDetailPage.tsx # /publishers/:id
│   │   └── SearchPage.tsx       # /search — Live debounced catalog search
│   ├── library/
│   │   └── LibraryPage.tsx      # /library — User shelf (auth-required)
│   ├── profile/
│   │   └── ProfilePage.tsx      # /profile/:username — Public shelf & activity
│   ├── series/
│   │   └── SeriesDetailPage.tsx # /series/:id — Core series page
│   ├── volume/
│   │   └── VolumeDetailPage.tsx # /volumes/:id — Interactive chapter read checklist & format picker
│   └── HomePage.tsx             # / — Hero, trending series, community activity stream
├── index.css               # Full design system: tokens, animations, components
├── App.tsx                 # Root router setup
└── main.tsx                # Entry point
```

---

## Development

### Commands

Run from the **repo root** (recommended):

```bash
pnpm dev      # Starts Vite dev server at http://localhost:5173
pnpm build    # Type-checks + builds to apps/web/dist/
pnpm lint     # Runs ESLint across all packages
```

---

## Design System

All styles live in `src/index.css`. Pure CSS variables for design tokens.

### Key Tokens

```css
--bg-page         /* #0e0f0e — darkest background */
--bg-surface      /* #161715 — card surfaces */
--bg-elevated     /* #1e1f1e — raised elements */
--vermillion      /* #C1401C — owned/action accent */
--ink-green       /* #3E5C3E — read status accent */
--ochre           /* #C99A3C — ratings accent */
--text-primary    /* #F0EDE8 — main text */
--text-secondary  /* #B8B0A8 — secondary text */
--text-muted      /* #7A7068 — muted/placeholder */
```

---

## Deployment

The app is deployed automatically to **Cloudflare Pages** via GitHub Actions on push to `main`.
