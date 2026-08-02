/**
 * Supabase upsert helpers for the ingest scripts.
 * Uses the SERVICE KEY (bypasses RLS) — never expose this key client-side.
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,   // service role key — RLS bypassed
)

export interface UpsertResult {
  id: string
  inserted: boolean
}

/** Cache publisher slug/name -> DB UUID */
const publisherCache = new Map<string, string>()

/** Resolve publisher slug or name to a database UUID, inserting if missing */
export async function resolvePublisherId(slugOrNameOrUuid: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrNameOrUuid)
  if (isUuid) return slugOrNameOrUuid

  const normalized = slugOrNameOrUuid.trim().toLowerCase()
  if (publisherCache.has(normalized)) {
    return publisherCache.get(normalized)!
  }

  // 1. Try matching existing publisher by name
  const formattedName = slugOrNameOrUuid.replace(/_/g, ' ')
  const { data: existing } = await supabase
    .from('publishers')
    .select('id, name')
    .ilike('name', formattedName)
    .maybeSingle()

  if (existing) {
    publisherCache.set(normalized, existing.id)
    return existing.id
  }

  // 2. Insert new publisher on-the-fly
  const { data: inserted, error } = await supabase
    .from('publishers')
    .insert({
      name: formattedName.replace(/\b\w/g, l => l.toUpperCase()),
      country: 'JP',
      is_original_publisher: true
    })
    .select('id')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to create/resolve publisher "${slugOrNameOrUuid}": ${error?.message}`)
  }

  publisherCache.set(normalized, inserted.id)
  return inserted.id
}

/** Deep Idempotent Series Upsert: updates series metadata if modified. */
export async function upsertSeries(series: any, dryRun = false): Promise<UpsertResult | null> {
  if (dryRun) {
    console.log(`[dry-run] Would upsert series: ${series.title}`)
    return { id: 'dry-run-series-id', inserted: true }
  }

  // Resolve publisher ID if passed as slug
  const pubRef = series.original_publisher_slug || series.original_publisher_id
  if (pubRef) {
    series.original_publisher_id = await resolvePublisherId(pubRef)
  }

  const { _anilist_id, _mal_id, original_publisher_slug, ...insertData } = series

  // Check if series exists by title
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .ilike('title', series.title)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('series')
      .update(insertData)
      .eq('id', existing.id)

    if (error) {
      console.error(`[error] Failed to update series "${series.title}":`, error.message)
      return null
    }

    console.log(`[~] Updated series: ${series.title} (${existing.id})`)
    return { id: existing.id, inserted: false }
  }

  const { data, error } = await supabase.from('series').insert(insertData).select('id').single()

  if (error || !data) {
    console.error(`[error] Failed to insert series "${series.title}":`, error?.message)
    return null
  }

  console.log(`[+] Inserted series: ${series.title} (${data.id})`)
  return { id: data.id, inserted: true }
}

/** Deep Idempotent Volume Upsert */
export async function upsertVolumes(volumes: any[], dryRun = false): Promise<number> {
  const prefix = dryRun ? '[dry-run] Would upsert' : '[live] Upserting'
  console.log(`${prefix} ${volumes.length} volumes for series ${volumes[0]?.series_id}`)

  if (dryRun) {
    for (const vol of volumes) {
      console.log(`  - Volume ${vol.volume_number} (Region: ${vol.region_code})`)
    }
    return 0
  }

  let inserted = 0
  for (const vol of volumes) {
    const pubRef = vol.publisher_slug || vol.publisher_id
    if (pubRef) {
      vol.publisher_id = await resolvePublisherId(pubRef)
    }

    const { chapters, publisher_slug, ...volData } = vol

    // 1. Upsert Volume
    const { data: volResult, error: volError } = await supabase
      .from('volumes')
      .upsert(volData, { onConflict: 'series_id,volume_number,region_code' })
      .select('id')
      .single()

    if (volError || !volResult) {
      console.warn(`[warn] Volume ${vol.volume_number} upsert failed:`, volError?.message)
      continue
    }

    inserted++
    const volumeId = volResult.id

    // 2. Process Chapters if present
    if (chapters && Array.isArray(chapters)) {
      for (const rawChap of chapters) {
        const cNum = Number(rawChap.chapter_number)
        if (isNaN(cNum)) continue

        const chapterPayload = {
          series_id: vol.series_id,
          chapter_number: cNum,
          title: rawChap.title || null,
          original_release_date: rawChap.original_release_date || null
        }

        const { data: existingChap } = await supabase
          .from('chapters')
          .select('id')
          .eq('series_id', vol.series_id)
          .eq('chapter_number', cNum)
          .maybeSingle()

        let chapterId: string

        if (existingChap) {
          chapterId = existingChap.id
          await supabase.from('chapters').update(chapterPayload).eq('id', chapterId)
        } else {
          const { data: newChap, error: chapError } = await supabase
            .from('chapters')
            .insert(chapterPayload)
            .select('id')
            .single()

          if (chapError || !newChap) continue
          chapterId = newChap.id
        }

        await supabase
          .from('volume_chapters')
          .upsert({ volume_id: volumeId, chapter_id: chapterId }, { onConflict: 'volume_id,chapter_id' })
      }
    }
  }
  return inserted
}
