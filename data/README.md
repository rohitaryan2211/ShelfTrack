# ShelfTrack Catalog Data (`data/`)

This folder contains the hand-curated catalog data for ShelfTrack. It is tracked in git so contributors can submit new series by opening pull requests.

---

## Structure

```
data/
├── mock_schema_reference.json     # JSON schema template ($version: 2) — read this before adding a series
└── vetted/
    └── <series_slug>/
        └── data.json              # Series + volumes metadata
```

### `vetted/`

Each subdirectory under `vetted/` represents one series and must contain a `data.json` file. The directory name should be the series title in lowercase with underscores (e.g. `jujutsu_kaisen`, `one_piece`).

### `mock_schema_reference.json`

A reference JSON template showing the exact shape of a valid `$version: 2` `data.json` file. **Read this first** before authoring series data.

---

## Adding a New Series

1. Create a new folder under `data/vetted/` named after the series (lowercase + underscores).
2. Inside it, create `data.json` following `$version: 2` schema in `mock_schema_reference.json`.
3. Verify your JSON structure with a dry-run push:
   ```bash
   pnpm push --dry-run
   ```
4. Open a pull request — a curator will review and push it to the live database.

---

## JSON Schema Summary ($version: 2)

See the full field specification in [docs/data_ingestion_guide.md](../docs/data_ingestion_guide.md).

### Series fields (`series` key)

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | ✅ | English title — used as deduplication key |
| `original_title` | `string \| null` | — | Japanese/original script title |
| `type` | `"manga" \| "novel" \| "light_novel"` | ✅ | |
| `genre` | `"shonen" \| "shojo" \| "seinen" \| "josei" \| "fantasy" \| "romance" \| "horror" \| "sci_fi" \| "slice_of_life" \| "action" \| "comedy" \| "other"` | — | |
| `description` | `string \| null` | — | Synopsis |
| `author` | `string \| null` | — | Author / mangaka name (e.g. `"Gege Akutami"`) |
| `original_publisher_slug` | `string` | ✅ | Human-readable publisher slug (e.g. `"shueisha"` or `"kodansha"`) |
| `status` | `"ongoing" \| "completed" \| "hiatus"` | ✅ | |
| `cover_url` | `string \| null` | — | Fully qualified URL |
| `ingest_status` | `"draft" \| "published" \| "rejected"` | ✅ | Use `"published"` to go live immediately |

### Volume fields (`volumes` array)

Each entry in `volumes` represents one regional edition (e.g. JP volume 1 and US volume 1 are two separate objects):

| Field | Type | Required | Notes |
|---|---|---|---|
| `volume_number` | `number` | ✅ | Supports decimals (e.g. `1.5`) |
| `title` | `string \| null` | — | Volume-specific title if any |
| `description` | `string \| null` | — | Volume summary or synopsis (defaults to `null`) |
| `publisher_slug` | `string` | ✅ | Publisher slug (e.g. `"viz_media"`, `"shueisha"`, `"seven_seas"`) |
| `region_code` | `string` | ✅ | `JP`, `US`, `GB`, `IN`, `DE`, `FR`, etc. |
| `edition_type` | `"single" \| "omnibus" \| "deluxe" \| "digital_only"` | — | Edition variant format (defaults to `"single"`) |
| `language_code` | `string` | — | Language ISO code (defaults to lowercase `region_code`) |
| `isbn` | `string \| null` | — | 13-digit ISBN (e.g. `9784088815169`) |
| `release_date` | `string \| null` | — | `YYYY-MM-DD` |
| `cover_url` | `string \| null` | — | Cover illustration URL |
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

## Migration Utility (`pnpm data:migrate`)

If you have legacy `$version: 1` data files using database UUIDs, run:

```bash
pnpm data:migrate
```

This will automatically format all JSON files in `data/vetted/` to `$version: 2` with publisher slugs.
