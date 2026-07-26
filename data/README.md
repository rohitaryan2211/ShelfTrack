# ShelfTrack Catalog Data (`data/`)

This folder contains the hand-curated catalog data for ShelfTrack. It is tracked in git so contributors can submit new series by opening pull requests.

> **Note**: This was previously the hidden `.data/` folder. It has been made public so the community can contribute series data directly via PR.

---

## Structure

```
data/
├── mock_schema_reference.json     # JSON schema template — read this before adding a series
└── vetted/
    └── <series_slug>/
        └── data.json              # Series + volumes metadata
```

### `vetted/`

Each subdirectory under `vetted/` represents one series and must contain a `data.json` file. The directory name should be the series title in lowercase with underscores (e.g. `jujutsu_kaisen`, `one_piece`).

### `mock_schema_reference.json`

A reference JSON template showing the exact shape of a valid `data.json` file. **Read this first** before authoring series data.

---

## Adding a New Series

1. Create a new folder under `data/vetted/` named after the series (lowercase + underscores).
2. Inside it, create `data.json` following the schema in `mock_schema_reference.json`.
3. Verify your JSON structure with a dry-run push:
   ```bash
   cd scripts
   pnpm tsx ingest/push.ts --dry-run
   ```
4. Open a pull request — a curator will review and push it to the live database.

---

## JSON Schema Summary

See the full field specification in [docs/data_ingestion_guide.md](../docs/data_ingestion_guide.md).

### Series fields (`series` key)

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | ✅ | English title — used as deduplication key |
| `original_title` | `string \| null` | — | Japanese/original script title |
| `type` | `"manga" \| "novel" \| "light_novel"` | ✅ | |
| `genre` | `"shonen" \| "shojo" \| "seinen" \| "josei" \| "fantasy" \| "romance" \| "horror" \| "sci_fi" \| "slice_of_life" \| "action" \| "comedy" \| "other"` | — | |
| `description` | `string \| null` | — | Synopsis |
| `original_publisher_id` | `uuid` | ✅ | Look up from the `publishers` DB table |
| `status` | `"ongoing" \| "completed" \| "hiatus"` | ✅ | |
| `cover_url` | `string \| null` | — | Fully qualified URL |
| `ingest_status` | `"draft" \| "published" \| "rejected"` | ✅ | Use `"published"` to go live immediately |

### Volume fields (`volumes` array)

Each entry in `volumes` represents one regional edition (e.g. JP volume 1 and US volume 1 are two separate objects):

| Field | Type | Required | Notes |
|---|---|---|---|
| `volume_number` | `number` | ✅ | Supports decimals (e.g. `1.5`) |
| `title` | `string \| null` | — | Volume-specific title if any |
| `publisher_id` | `uuid` | ✅ | Original publisher or licensor UUID |
| `region_code` | `string` | ✅ | `JP`, `US`, `GB`, `IN`, `DE`, `FR`, etc. |
| `cover_url` | `string \| null` | — | |
| `isbn13` | `string \| null` | — | 13-digit, no hyphens (e.g. `9784088815169`) |
| `release_date` | `string \| null` | — | `YYYY-MM-DD` |
| `page_count` | `number \| null` | — | |
| `ingest_status` | `"draft" \| "published" \| "rejected"` | ✅ | |
| `chapters` | `Chapter[]` | — | Optional array of chapters in this volume |

### Chapter fields (inside a volume's `chapters` array)

| Field | Type | Notes |
|---|---|---|
| `chapter_number` | `number` | Supports decimals (e.g. `121.5`) |
| `title` | `string \| null` | Chapter title |
| `original_release_date` | `string \| null` | `YYYY-MM-DD` |

---

## Publisher UUIDs

The `publisher_id` and `original_publisher_id` fields require UUIDs from the live database. To look one up:

```typescript
const { data } = await supabase
  .from('publishers')
  .select('id, name')
  .ilike('name', 'Shueisha')
  .single()
// data.id is the UUID to use
```

Or run the db inspect script from `scripts/`:

```bash
pnpm tsx db_inspect.ts
```
