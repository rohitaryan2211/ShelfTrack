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
│   ├── AppLayout.tsx       # Sidebar + bottom nav shell, auth-aware
│   ├── Cards.tsx           # SeriesCard, VolumeCard, SkeletonCard
│   └── ProtectedRoute.tsx  # Auth guard wrapper
├── hooks/
│   └── useAuth.tsx         # Supabase Auth context + hook
├── lib/
│   ├── supabaseClient.ts   # Supabase client (uses VITE_ env vars)
│   ├── types.ts            # TypeScript interfaces mirroring DB schema
│   └── regionLabels.ts     # Human-readable region code labels
├── routes/
│   ├── HomePage.tsx        # / — Hero, trending, features
│   ├── DiscoverPage.tsx    # /discover — Responsive series grid with filters
│   ├── SearchPage.tsx      # /search — Debounced live search
│   ├── PublishersPage.tsx  # /publishers — Publisher index
│   ├── PublisherDetailPage.tsx  # /publishers/:id
│   ├── SeriesDetailPage.tsx     # /series/:id — Core tracking page
│   ├── VolumeDetailPage.tsx     # /volumes/:id
│   ├── LibraryPage.tsx     # /library — User shelf (auth-required)
│   ├── ProfilePage.tsx     # /profile/:username
│   ├── SettingsPage.tsx    # /settings
│   ├── LoginPage.tsx       # /login
│   └── AdminIngestPage.tsx # /admin/ingest — Curator queue + forms
├── index.css               # Full design system: tokens, animations, components
├── App.tsx                 # Root router setup
└── main.tsx                # Entry point
```

---

## Development

### Prerequisites

- Node.js ≥ 20
- pnpm

### Environment Variables

Create `apps/web/.env.local` (or set in Cloudflare dashboard):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> The anon key is safe to expose in the frontend — Supabase Row Level Security policies control what users can access.

### Commands

Run from the **repo root** (recommended):

```bash
pnpm dev      # Starts Vite dev server at http://localhost:5173
pnpm build    # Type-checks + builds to apps/web/dist/
pnpm lint     # Runs ESLint across all packages
```

Or run directly from `apps/web/`:

```bash
pnpm dev
pnpm build    # tsc -b && vite build
pnpm preview  # Preview the production build locally
```

---

## Design System

All styles live in `src/index.css`. No Tailwind — pure CSS variables for design tokens.

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

### Typography

- **Headings**: `Shippori Mincho` (calligraphic Japanese serif)
- **Body**: `Zen Kaku Gothic New` (clean Japanese gothic sans-serif)

Both loaded from Google Fonts.

### Utility Classes

Key reusable classes available globally:

| Class | Purpose |
|---|---|
| `.card` | Standard card with border + background |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` | Button variants |
| `.btn-sm`, `.btn-lg` | Size modifiers |
| `.badge`, `.badge-vermillion`, `.badge-ink-green`, `.badge-ochre` | Status badges |
| `.input`, `.input-group` | Form inputs with icon support |
| `.section-header` | Two-column section title + action row |
| `.discover-grid` | Responsive `auto-fill` series grid |
| `.scroll-row` | Horizontal overflow scroll row |
| `.skeleton` | Shimmer loading placeholder |
| `.empty-state` | Centered empty state with icon |
| `.animate-fade-in`, `.animate-fade-up`, `.delay-100` etc. | Entrance animations |
| `.volume-card`, `.volume-card-cover`, `.volume-card-body` | Series/volume card anatomy |

---

## ESLint Configuration

For stricter type-aware lint rules in production, extend `eslint.config.js`:

```js
import tseslint from 'typescript-eslint'
import { globalIgnores, defineConfig } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      // or tseslint.configs.strictTypeChecked for stricter rules
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

You can also add React-specific rules:

```js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      reactX.configs['recommended-typescript'],
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

See [`@vitejs/plugin-react`](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) and [`@vitejs/plugin-react-swc`](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) for build plugin options.

> The React Compiler is not enabled by default due to its impact on dev & build performance. To add it, see the [React Compiler installation docs](https://react.dev/learn/react-compiler/installation).

---

## Deployment

The app is deployed automatically to **Cloudflare Pages** via GitHub Actions on push to `main`.

Build settings:
- **Build command**: `pnpm build`
- **Build output directory**: `apps/web/dist`
- **Root directory**: `/` (repo root, for monorepo support)
