#!/usr/bin/env tsx
/**
 * SEED SCRIPT — Run once to populate the initial catalog.
 *
 * Usage:
 *   npx tsx scripts/ingest/seed.ts             # real insert (drafts)
 *   npx tsx scripts/ingest/seed.ts --dry-run   # logs what would be inserted
 *   npx tsx scripts/ingest/seed.ts --publish   # insert as published (use for verified seed)
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY in .env (or env vars)
 *   - Migrations 0001–0006 applied to the Supabase project
 *
 * Data flow:
 *   AniList (series metadata + cover) → transform → upsert as draft
 *   MangaUpdates (volume count) → build volume rows → upsert
 *   Google Books (ISBN per volume) → patch isbn13 on existing volume rows
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { searchSeries as muSearchSeries, getSeriesById as muGetSeriesById } from './sources/mangaupdates.ts'
import { getMangaDexCovers } from './sources/mangadex.ts'
import { getVolumeISBN } from './sources/googlebooks.ts'
import { transformMUSeries, extractMUVolumes, buildVolumeInserts, seedPublisherCache, lookupPublisherId } from './transform.ts'
import { upsertSeries, upsertVolumes, fetchPublishers } from './upsert.ts'

// ── Flagship series to seed ────────────────────────────────────────
// Adjust this list to extend coverage.
const SEED_LIST = [
  // Shueisha
  { title: 'One Piece',           publisher: 'Shueisha' },
  { title: 'Jujutsu Kaisen',      publisher: 'Shueisha' },
  { title: 'Demon Slayer',        publisher: 'Shueisha' },
  { title: 'My Hero Academia',    publisher: 'Shueisha' },
  { title: 'Chainsaw Man',        publisher: 'Shueisha' },
  // Kodansha
  { title: 'Attack on Titan',     publisher: 'Kodansha' },
  { title: 'Vinland Saga',        publisher: 'Kodansha' },
  { title: 'Blue Period',         publisher: 'Kodansha' },
  { title: 'Spy x Family',        publisher: 'Shueisha' },
  { title: 'Frieren',             publisher: 'Shogakukan' },
  { title: 'Tower of God',        publisher: 'Webtoon' }, // Test fallback: often named differently or missing on AL
]

const DRY_RUN = process.argv.includes('--dry-run')
const PUBLISH = process.argv.includes('--publish')
const INGEST_STATUS = PUBLISH ? 'published' as const : 'draft' as const

interface Summary {
  seriesInserted: number
  seriesSkipped: number
  volumesInserted: number
  errors: string[]
}

async function main() {
  console.log(`\n🚀 ShelfTrack Seed Script`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : PUBLISH ? 'PUBLISH (live)' : 'DRAFT (needs curator approval)'}`)
  console.log(`   Series to seed: ${SEED_LIST.length}\n`)

  // 1. Load publisher ID cache
  const publishers = await fetchPublishers()
  seedPublisherCache(publishers)
  console.log(`✓ Loaded ${publishers.length} publishers from DB\n`)

  const summary: Summary = { seriesInserted: 0, seriesSkipped: 0, volumesInserted: 0, errors: [] }

  for (const item of SEED_LIST) {
    console.log(`\n──────────────────────────────────────`)
    console.log(`📚 Processing: ${item.title}`)

    try {
      // 2. Search MangaUpdates
      let seriesInsert
      let totalVolumes = 1
      let coverImage = null
      
      const publisherId = lookupPublisherId(item.publisher)
      if (!publisherId) console.warn(`   ⚠ Publisher not found in DB: ${item.publisher}`)

      const muResults = await muSearchSeries(item.title, 1, 1)
      const muHit = muResults[0]
      if (!muHit) {
        console.warn(`   ⚠ Not found on MangaUpdates: ${item.title}`)
        summary.errors.push(`Not found on MU: ${item.title}`)
        continue
      }

      const muSeries = await muGetSeriesById(muHit.record.series_id)
      if (!muSeries) {
        console.warn(`   ⚠ Failed to fetch MU series details: ${item.title}`)
        continue
      }

      console.log(`   MangaUpdates: "${muSeries.title}" (id: ${muSeries.series_id})`)
      seriesInsert = transformMUSeries(muSeries, publisherId, INGEST_STATUS)
      totalVolumes = extractMUVolumes(muSeries.status)
      coverImage = muSeries.image?.url?.original ?? null

      // 4. Upsert series
      const result = await upsertSeries(seriesInsert, DRY_RUN)

      if (!result) { summary.seriesSkipped++; continue }
      if (!result.inserted) { 
        summary.seriesSkipped++;
        // Do NOT continue here; we still want to build/upsert volumes for existing series!
      }

      summary.seriesInserted++
      const seriesId = result.id

      // 5. Build volumes
      console.log(`   Fetching MangaDex covers for ${totalVolumes} volumes…`)
      const mangadexCovers = await getMangaDexCovers(item.title)
      const foundCovers = Object.keys(mangadexCovers).length
      if (foundCovers > 0) console.log(`   ✓ Found ${foundCovers} precise volume covers on MangaDex!`)

      console.log(`   Building ${totalVolumes} volume rows…`)
      const volumes = buildVolumeInserts(seriesId, publisherId, totalVolumes, coverImage, INGEST_STATUS, mangadexCovers)
      const volumesInserted = await upsertVolumes(volumes, DRY_RUN)
      summary.volumesInserted += volumesInserted
      console.log(`   ✓ ${volumesInserted}/${totalVolumes} volumes inserted`)

      // 6. Optionally enrich with ISBN (slow — 1 Google Books call per volume)
      // Only for the first 3 volumes to avoid rate limits during seed
      if (!DRY_RUN && process.env.GOOGLE_BOOKS_API_KEY) {
        console.log(`   Fetching ISBNs for first 3 volumes…`)
        for (const vol of volumes.slice(0, 3)) {
          const isbn = await getVolumeISBN(item.title, vol.volume_number)
          if (isbn) console.log(`   ISBN vol.${vol.volume_number}: ${isbn}`)
          await new Promise(r => setTimeout(r, 300)) // rate limit
        }
      }

      // Polite delay between series
      await new Promise(r => setTimeout(r, 1000))

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ✗ Error processing "${item.title}": ${msg}`)
      summary.errors.push(`${item.title}: ${msg}`)
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Seed complete!`)
  console.log(`   Series inserted: ${summary.seriesInserted}`)
  console.log(`   Series skipped:  ${summary.seriesSkipped}`)
  console.log(`   Volumes inserted: ${summary.volumesInserted}`)
  if (summary.errors.length) {
    console.log(`   Errors (${summary.errors.length}):`)
    summary.errors.forEach(e => console.log(`     - ${e}`))
  }
  if (!DRY_RUN && !PUBLISH) {
    console.log(`\n💡 All entries are in DRAFT status.`)
    console.log(`   Go to /admin/ingest to review and approve them.`)
  }
}

main().catch(console.error)
