#!/usr/bin/env tsx
/**
 * AUTONOMOUS CATALOG SYNC
 *
 * Builds and maintains the manga catalog from free public APIs — no keys, no cost:
 *   AniList      → which series exist, titles, synopsis, author, status, popularity, cover
 *   MangaDex     → demographic, per-volume covers, chapter → volume mapping
 *   MangaUpdates → original publisher, English licensor + English volume count
 *
 * Everything is published immediately (no curator queue). Run weekly by
 * .github/workflows/catalog-sync.yml; safe to re-run any time — it only adds or refreshes.
 *
 * Usage (from repo root):
 *   pnpm sync                          # weekly: refresh existing + add new popular/trending
 *   pnpm sync --dry-run --only=105778  # fetch & print one series, no DB access
 *   pnpm sync --discover=1000 --max-new=500   # bigger backfill
 *
 * Flags:
 *   --dry-run            Fetch from APIs and print what would be written. Never touches the DB.
 *   --discover=N         Top-N most popular manga to consider (default 300)
 *   --trending=N         Top-N currently trending manga to consider (default 50)
 *   --max-new=N          Cap on new series added per run (default 150)
 *   --refresh-days=N     Fully re-sync completed series after N days (default 30)
 *   --countries=JP,KR    Countries of origin to include (default JP,KR)
 *   --only=ID[,ID]       Only these AniList IDs
 *   --budget-min=N       Stop starting new work after N minutes (default 50)
 */
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { appendFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import * as anilist from './sources/anilist.ts'
import type { AniListMedia } from './sources/anilist.ts'
import { buildBundle, seriesFieldsFromAniList } from './build.ts'
import {
  createDb, loadExistingSeries, writeBundle, refreshMetadata, startRun, finishRun,
  type ExistingSeries, type RunTotals,
} from './db.ts'
import { pickTitle } from './map.ts'

// ─── Args ────────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}
const num = (name: string, fallback: number) => {
  const v = Number(arg(name))
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

const DRY_RUN = process.argv.includes('--dry-run')
const DISCOVER = num('discover', 300)
const TRENDING = num('trending', 50)
const MAX_NEW = num('max-new', 150)
const REFRESH_DAYS = num('refresh-days', 30)
const BUDGET_MS = num('budget-min', 50) * 60_000
const COUNTRIES = new Set((arg('countries') ?? 'JP,KR').split(',').map(c => c.trim().toUpperCase()).filter(Boolean))
const ONLY = (arg('only') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)

const startedAt = Date.now()
const overBudget = () => Date.now() - startedAt > BUDGET_MS

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

function eligible(m: AniListMedia) {
  return !m.isAdult && (!m.countryOfOrigin || COUNTRIES.has(m.countryOfOrigin))
}

function needsFullSync(existing: ExistingSeries, media: AniListMedia): boolean {
  if (!existing.last_synced_at) return true
  const fields = seriesFieldsFromAniList(media)
  if (fields.status !== existing.status) return true
  if (fields.status !== 'completed') return true // ongoing series get new volumes/chapters
  const ageDays = (Date.now() - Date.parse(existing.last_synced_at)) / 86_400_000
  return ageDays >= REFRESH_DAYS
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📚 ShelfTrack catalog sync — ${DRY_RUN ? 'DRY RUN (no database access)' : 'LIVE'}`)
  console.log(`   discover=${DISCOVER} trending=${TRENDING} max-new=${MAX_NEW} refresh-days=${REFRESH_DAYS} countries=${[...COUNTRIES].join(',')}\n`)

  const totals: RunTotals = { series_checked: 0, series_added: 0, series_updated: 0, volumes_added: 0, chapters_added: 0, errors: [] }

  // 1. Candidates from AniList
  let candidates: AniListMedia[]
  if (ONLY.length) {
    candidates = await anilist.getMangaByIds(ONLY)
  } else {
    const [popular, trending] = [
      await anilist.listManga('POPULARITY_DESC', DISCOVER),
      await anilist.listManga('TRENDING_DESC', TRENDING),
    ]
    const byId = new Map<number, AniListMedia>()
    for (const m of [...popular, ...trending]) byId.set(m.id, m)
    candidates = [...byId.values()]
  }
  candidates = candidates.filter(eligible)
  console.log(`✓ ${candidates.length} candidate series from AniList`)

  if (DRY_RUN) {
    for (const media of candidates.slice(0, ONLY.length || 3)) {
      const bundle = await buildBundle(media)
      const byRegion = bundle.volumes.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v.region_code]: (acc[v.region_code] ?? 0) + 1 }), {})
      const coversFound = bundle.volumes.filter(v => v.cover_url).length
      console.log(`\n— ${bundle.series.title} (AniList ${bundle.series.anilist_id}, MangaDex ${bundle.series.mangadex_id ?? 'not found'})`)
      console.log(`  status=${bundle.series.status} genre=${bundle.series.genre} author=${bundle.series.author ?? '—'}`)
      console.log(`  original publisher=${bundle.originalPublisher ?? '—'}  English licensor=${bundle.englishLicensor ? `${bundle.englishLicensor.name} (${bundle.englishLicensor.volumes} vols)` : '—'}`)
      console.log(`  volumes=${JSON.stringify(byRegion)} covers=${coversFound}/${bundle.volumes.length}`)
      console.log(`  chapters=${bundle.chapters.length} mapped to volumes=${bundle.chapterVolume.size}`)
      console.log(`  description: ${(bundle.series.description ?? '—').slice(0, 140).replace(/\n/g, ' ')}…`)
    }
    console.log(`\n(dry run: showed ${Math.min(candidates.length, ONLY.length || 3)} of ${candidates.length})`)
    return
  }

  const db = createDb()
  const runId = await startRun(db, ONLY.length ? 'manual' : 'weekly')
  let status: 'success' | 'partial' | 'failed' = 'success'

  try {
    const existing = await loadExistingSeries(db)
    const byAniList = new Map(existing.filter(e => e.anilist_id).map(e => [e.anilist_id!, e]))
    const byTitle = new Map<string, ExistingSeries>()
    for (const e of existing) {
      if (e.anilist_id) continue
      byTitle.set(norm(e.title), e)
      if (e.original_title) byTitle.set(norm(e.original_title), e)
    }
    console.log(`✓ ${existing.length} series already in the catalog`)

    // 2. Link hand-curated series (no AniList ID yet) by exact title
    for (const e of existing.filter(e => !e.anilist_id)) {
      if (ONLY.length) break
      try {
        const hits = await anilist.searchManga(e.title)
        const match = hits.find(h => [h.title.english, h.title.romaji, h.title.native, ...(h.synonyms ?? [])].some(t => norm(t) === norm(e.title)))
        if (match && !candidates.some(c => c.id === match.id)) candidates.push(match)
      } catch (err) {
        totals.errors.push({ series: e.title, error: `link: ${(err as Error).message}` })
      }
    }

    // 3. Refresh everything we already track with an AniList ID (cheap: 50 per request)
    const trackedIds = [...byAniList.keys()].filter(id => !ONLY.length || ONLY.includes(id))
    const tracked = trackedIds.length ? await anilist.getMangaByIds(trackedIds) : []
    const trackedById = new Map(tracked.map(m => [m.id, m]))
    for (const m of candidates) if (byAniList.has(m.id)) trackedById.set(m.id, m)

    const work: { media: AniListMedia; existing: ExistingSeries | null }[] = []
    for (const [id, media] of trackedById) {
      const row = byAniList.get(id)!
      if (needsFullSync(row, media)) {
        work.push({ media, existing: row })
      } else {
        totals.series_checked++
        try {
          await refreshMetadata(db, row, seriesFieldsFromAniList(media))
          totals.series_updated++
        } catch (err) {
          totals.errors.push({ series: row.title, error: (err as Error).message })
        }
      }
    }

    // 4. New series, most popular first, capped per run
    const fresh = candidates
      .filter(m => !byAniList.has(m.id))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    let newCount = 0
    for (const media of fresh) {
      const titleMatch = [media.title.english, media.title.romaji, media.title.native, ...(media.synonyms ?? [])]
        .map(norm).map(t => byTitle.get(t)).find(Boolean) ?? null
      if (!titleMatch) {
        if (newCount >= MAX_NEW) continue
        newCount++
      }
      work.push({ media, existing: titleMatch })
    }

    console.log(`→ ${work.length} series need a full sync (${newCount} new)\n`)

    // 5. Full sync, one series at a time (APIs are rate limited anyway)
    for (const [i, { media, existing: row }] of work.entries()) {
      if (overBudget()) {
        console.log(`⏱ Time budget reached — ${work.length - i} series left for the next run.`)
        break
      }
      const label = pickTitle(media)
      totals.series_checked++
      try {
        const bundle = await buildBundle(media)
        const result = await writeBundle(db, bundle, row)
        if (result.inserted) totals.series_added++
        else totals.series_updated++
        totals.volumes_added += result.volumesAdded
        totals.chapters_added += result.chaptersAdded
        console.log(`[${i + 1}/${work.length}] ${result.inserted ? '+' : '~'} ${label} — +${result.volumesAdded} vols, +${result.chaptersAdded} chapters`)
      } catch (err) {
        const msg = (err as Error).message
        totals.errors.push({ series: label, error: msg })
        console.warn(`[${i + 1}/${work.length}] ✗ ${label}: ${msg}`)
      }
    }

    if (totals.errors.length) status = totals.series_added + totals.series_updated > 0 ? 'partial' : 'failed'
  } catch (err) {
    status = 'failed'
    totals.errors.push({ series: '(run)', error: (err as Error).message })
    throw err
  } finally {
    await finishRun(db, runId, totals, status)
    report(totals, status)
  }

  if (status === 'failed') process.exit(1)
}

function report(t: RunTotals, status: string) {
  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1)
  const lines = [
    `## Catalog sync: ${status}`,
    '',
    '| Series checked | Added | Updated | Volumes added | Chapters added | Errors | Minutes |',
    '|---|---|---|---|---|---|---|',
    `| ${t.series_checked} | ${t.series_added} | ${t.series_updated} | ${t.volumes_added} | ${t.chapters_added} | ${t.errors.length} | ${minutes} |`,
  ]
  if (t.errors.length) {
    lines.push('', '<details><summary>Errors</summary>', '')
    for (const e of t.errors.slice(0, 50)) lines.push(`- **${e.series}**: ${e.error}`)
    lines.push('', '</details>')
  }
  const md = lines.join('\n')
  console.log(`\n${md}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n')
}

main().catch(err => {
  console.error(`\n✗ Sync failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  process.exit(1)
})
