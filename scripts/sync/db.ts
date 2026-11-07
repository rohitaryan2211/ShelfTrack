/**
 * Database writes for the catalog sync. Uses the service-role key (bypasses RLS).
 *
 * Rules:
 * - Series created by the sync (source = 'sync') are fully refreshed each time.
 * - Hand-curated series (source = 'manual', e.g. data/vetted) are only linked to
 *   their external IDs and have empty fields filled in — curated values win.
 * - Volumes and chapters are only ever added, never deleted; existing volume
 *   covers are kept, missing ones are filled in.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SeriesBundle, SeriesFields } from './build.ts'
import { slugify } from './map.ts'

export interface ExistingSeries {
  id: string
  anilist_id: number | null
  title: string
  original_title: string | null
  source: string
  status: string
  last_synced_at: string | null
  description: string | null
  cover_url: string | null
  author: string | null
  genre: string | null
  original_publisher_id: string | null
}

export interface WriteResult {
  seriesId: string
  inserted: boolean
  volumesAdded: number
  chaptersAdded: number
}

const PAGE = 1000

export function createDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
  return createClient(url, key, { auth: { persistSession: false } })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function loadExistingSeries(db: SupabaseClient): Promise<ExistingSeries[]> {
  return selectAll<ExistingSeries>((from, to) =>
    db.from('series')
      .select('id, anilist_id, title, original_title, source, status, last_synced_at, description, cover_url, author, genre, original_publisher_id')
      .order('id')
      .range(from, to),
  )
}

// ─── Publishers ──────────────────────────────────────────────────────────────
const publisherCache = new Map<string, string>()

export async function resolvePublisher(db: SupabaseClient, name: string, country: string, isOriginal: boolean): Promise<string> {
  const slug = slugify(name)
  const cached = publisherCache.get(slug)
  if (cached) return cached

  const bySlug = await db.from('publishers').select('id').eq('slug', slug).maybeSingle()
  if (bySlug.error) throw new Error(bySlug.error.message)
  let id = bySlug.data?.id as string | undefined

  if (!id) {
    const byName = await db.from('publishers').select('id, slug').ilike('name', name).limit(1).maybeSingle()
    if (byName.error) throw new Error(byName.error.message)
    if (byName.data) {
      id = byName.data.id
      if (!byName.data.slug) await db.from('publishers').update({ slug }).eq('id', id)
    }
  }

  if (!id) {
    const ins = await db.from('publishers')
      .insert({ name, slug, country, is_original_publisher: isOriginal })
      .select('id')
      .single()
    if (ins.error) throw new Error(`publisher "${name}": ${ins.error.message}`)
    id = ins.data.id
  }

  publisherCache.set(slug, id!)
  return id!
}

// ─── Series ──────────────────────────────────────────────────────────────────
type SeriesRow = SeriesFields & {
  original_publisher_id?: string | null
  ingest_status: 'published'
  source: string
  last_synced_at: string
}

/** Fields that are factual and source-owned; always refreshed, even on curated series. */
function factualFields(s: SeriesFields) {
  return {
    anilist_id: s.anilist_id,
    mal_id: s.mal_id,
    mangadex_id: s.mangadex_id,
    mangaupdates_id: s.mangaupdates_id,
    popularity: s.popularity,
    average_score: s.average_score,
    volume_count: s.volume_count,
    chapter_count: s.chapter_count,
    start_year: s.start_year,
    genres: s.genres,
    status: s.status,
    last_synced_at: new Date().toISOString(),
  }
}

/** Cheap refresh from AniList metadata only (no MangaDex/MangaUpdates calls). */
export async function refreshMetadata(db: SupabaseClient, existing: ExistingSeries, fields: SeriesFields) {
  const update: Record<string, unknown> = { ...factualFields(fields) }
  // Keep IDs we resolved earlier from MangaDex — AniList alone doesn't know them.
  delete update.mangadex_id
  delete update.mangaupdates_id
  // Volume/chapter counts from AniList alone are null for ongoing series; don't wipe better data.
  if (fields.volume_count == null) delete update.volume_count
  if (fields.chapter_count == null) delete update.chapter_count
  const { error } = await db.from('series').update(update).eq('id', existing.id)
  if (error) throw new Error(error.message)
}

export async function writeBundle(db: SupabaseClient, bundle: SeriesBundle, existing: ExistingSeries | null): Promise<WriteResult> {
  const s = bundle.series

  const originalPublisherId = bundle.originalPublisher
    ? await resolvePublisher(db, bundle.originalPublisher, bundle.originRegion, true)
    : null

  // 1. Series row
  let seriesId: string
  let inserted = false
  if (existing && existing.source !== 'sync') {
    const update: Record<string, unknown> = { ...factualFields(s) }
    if (!existing.description) update.description = s.description
    if (!existing.cover_url) update.cover_url = s.cover_url
    if (!existing.author) update.author = s.author
    if (!existing.genre) update.genre = s.genre
    if (!existing.original_title) update.original_title = s.original_title
    if (!existing.original_publisher_id && originalPublisherId) update.original_publisher_id = originalPublisherId
    const { error } = await db.from('series').update(update).eq('id', existing.id)
    if (error) throw new Error(`series update: ${error.message}`)
    seriesId = existing.id
  } else {
    const row: SeriesRow = {
      ...s,
      original_publisher_id: originalPublisherId,
      ingest_status: 'published',
      source: 'sync',
      last_synced_at: new Date().toISOString(),
    }
    if (existing) {
      const { error } = await db.from('series').update(row).eq('id', existing.id)
      if (error) throw new Error(`series update: ${error.message}`)
      seriesId = existing.id
    } else {
      const { data, error } = await db.from('series').insert(row).select('id').single()
      if (error) throw new Error(`series insert: ${error.message}`)
      seriesId = data.id
      inserted = true
    }
  }

  // 2. Volumes — add missing, fill missing covers
  const existingVolumes = await selectAll<{ id: string; volume_number: number; region_code: string; cover_url: string | null }>((from, to) =>
    db.from('volumes').select('id, volume_number, region_code, cover_url').eq('series_id', seriesId).range(from, to),
  )
  const volKey = (region: string, n: number) => `${region}:${Number(n)}`
  const existingByKey = new Map(existingVolumes.map(v => [volKey(v.region_code, v.volume_number), v]))

  const toInsert = []
  for (const v of bundle.volumes) {
    const current = existingByKey.get(volKey(v.region_code, v.volume_number))
    if (current) {
      if (!current.cover_url && v.cover_url) {
        await db.from('volumes').update({ cover_url: v.cover_url }).eq('id', current.id)
      }
      continue
    }
    const publisherId = v.publisherName
      ? await resolvePublisher(db, v.publisherName, v.publisherCountry, v.isOriginalPublisher)
      : null
    toInsert.push({
      series_id: seriesId,
      volume_number: v.volume_number,
      region_code: v.region_code,
      language_code: v.language_code,
      edition_type: 'single',
      publisher_id: publisherId,
      cover_url: v.cover_url,
      ingest_status: 'published',
    })
  }
  for (const rows of chunk(toInsert, 500)) {
    const { error } = await db.from('volumes').upsert(rows, { onConflict: 'series_id,volume_number,region_code', ignoreDuplicates: true })
    if (error) throw new Error(`volumes insert: ${error.message}`)
  }

  // 3. English licensor
  if (bundle.englishLicensor) {
    const pubId = await resolvePublisher(db, bundle.englishLicensor.name, 'US', false)
    await db.from('series_licensors').upsert(
      { series_id: seriesId, region_code: 'US', publisher_id: pubId },
      { onConflict: 'series_id,region_code,publisher_id', ignoreDuplicates: true },
    )
  }

  // 4. Chapters — add missing
  const chaptersBefore = await countChapters(db, seriesId)
  for (const rows of chunk(bundle.chapters.map(n => ({ series_id: seriesId, chapter_number: n })), 1000)) {
    const { error } = await db.from('chapters').upsert(rows, { onConflict: 'series_id,chapter_number', ignoreDuplicates: true })
    if (error) throw new Error(`chapters insert: ${error.message}`)
  }
  const chaptersAfter = await countChapters(db, seriesId)

  // 5. Chapter ↔ volume links, only for volumes that have none yet (keeps curated mappings intact)
  if (bundle.chapterVolume.size > 0) {
    await linkChapters(db, seriesId, bundle)
  }

  return { seriesId, inserted, volumesAdded: toInsert.length, chaptersAdded: Math.max(0, chaptersAfter - chaptersBefore) }
}

async function countChapters(db: SupabaseClient, seriesId: string): Promise<number> {
  const { count, error } = await db.from('chapters').select('id', { count: 'exact', head: true }).eq('series_id', seriesId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function linkChapters(db: SupabaseClient, seriesId: string, bundle: SeriesBundle) {
  const [volumes, chapters] = await Promise.all([
    selectAll<{ id: string; volume_number: number; region_code: string }>((from, to) =>
      db.from('volumes').select('id, volume_number, region_code').eq('series_id', seriesId).range(from, to)),
    selectAll<{ id: string; chapter_number: number }>((from, to) =>
      db.from('chapters').select('id, chapter_number').eq('series_id', seriesId).range(from, to)),
  ])
  if (!volumes.length || !chapters.length) return

  const volumesWithLinks = new Set<string>()
  for (const ids of chunk(volumes.map(v => v.id), 100)) {
    const linked = await selectAll<{ volume_id: string }>((from, to) =>
      db.from('volume_chapters').select('volume_id').in('volume_id', ids).range(from, to))
    for (const l of linked) volumesWithLinks.add(l.volume_id)
  }

  const chapterId = new Map(chapters.map(c => [Number(c.chapter_number), c.id]))
  const rows: { volume_id: string; chapter_id: string }[] = []
  for (const vol of volumes) {
    // Single editions share the original numbering, so every edition of vol N gets the same chapters.
    if (volumesWithLinks.has(vol.id)) continue
    for (const [ch, volNum] of bundle.chapterVolume) {
      if (volNum !== Number(vol.volume_number)) continue
      const cid = chapterId.get(ch)
      if (cid) rows.push({ volume_id: vol.id, chapter_id: cid })
    }
  }
  for (const part of chunk(rows, 1000)) {
    const { error } = await db.from('volume_chapters').upsert(part, { onConflict: 'volume_id,chapter_id', ignoreDuplicates: true })
    if (error) throw new Error(`volume_chapters insert: ${error.message}`)
  }
}

// ─── Run log ─────────────────────────────────────────────────────────────────
export interface RunTotals {
  series_checked: number
  series_added: number
  series_updated: number
  volumes_added: number
  chapters_added: number
  errors: { series: string; error: string }[]
}

export async function startRun(db: SupabaseClient, mode: string): Promise<string | null> {
  const { data, error } = await db.from('sync_runs').insert({ mode }).select('id').single()
  if (error) {
    console.warn(`[sync] could not record run start: ${error.message}`)
    return null
  }
  return data.id
}

export async function finishRun(db: SupabaseClient, runId: string | null, totals: RunTotals, status: 'success' | 'partial' | 'failed') {
  if (!runId) return
  const { error } = await db.from('sync_runs').update({
    ...totals,
    errors: totals.errors.slice(0, 100),
    status,
    finished_at: new Date().toISOString(),
  }).eq('id', runId)
  if (error) console.warn(`[sync] could not record run finish: ${error.message}`)
}
