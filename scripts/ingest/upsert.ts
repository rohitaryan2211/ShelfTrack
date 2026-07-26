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
import type { SeriesInsert, VolumeInsert } from './transform.ts'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,   // service role key — RLS bypassed
)

export interface UpsertResult {
  id: string
  inserted: boolean
}

/** Upsert a series row. Deduplication key: title (case-insensitive). */
export async function upsertSeries(series: SeriesInsert, dryRun = false): Promise<UpsertResult | null> {
  if (dryRun) {
    console.log(`[dry-run] Would upsert series: ${series.title}`)
    return { id: 'dry-run-series-id', inserted: true }
  }

  // Check if a series with this title already exists
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .ilike('title', series.title)
    .single()

  if (existing) {
    console.log(`[skip] Series already exists: ${series.title} (${existing.id})`)
    return { id: existing.id, inserted: false }
  }

  // Remove internal _anilist_id and _mal_id fields before inserting
  const { _anilist_id, _mal_id, ...insertData } = series as SeriesInsert & { _anilist_id?: number, _mal_id?: number }
  const { data, error } = await supabase.from('series').insert(insertData).select('id').single()

  if (error || !data) {
    console.error(`[error] Failed to insert series "${series.title}":`, error?.message)
    return null
  }

  console.log(`[+] Inserted series: ${series.title} (${data.id})`)
  return { id: data.id, inserted: true }
}

/** Upsert volumes for a series. Dedup: (series_id, volume_number, region_code). */
export async function upsertVolumes(volumes: VolumeInsert[], dryRun = false): Promise<number> {
  const prefix = dryRun ? '[dry-run] Would upsert' : '[live] Upserting'
  console.log(`${prefix} ${volumes.length} volumes for series ${volumes[0]?.series_id}`)
  
  for (const vol of volumes) {
    console.log(`  - Volume ${vol.volume_number} (Region: ${vol.region_code})`)
    if (vol.chapters && Array.isArray(vol.chapters)) {
      const chapNumbers = vol.chapters.map(c => c.chapter_number)
      console.log(`    ↳ Chapters: ${chapNumbers.join(', ')}`)
    }
  }

  if (dryRun) {
    return 0
  }

  let inserted = 0
  for (const vol of volumes) {
    const { chapters, ...volData } = vol

    // 1. Upsert Volume and get its ID
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

        if (isNaN(cNum)) {
          console.warn(`[warn] Invalid chapter number for volume ${vol.volume_number}:`, rawChap.chapter_number)
          continue
        }

        const chapterPayload = {
          series_id: vol.series_id,
          chapter_number: cNum,
          title: rawChap.title || null,
          original_release_date: rawChap.original_release_date || null
        }

        // Check if chapter exists for this series
        const { data: existingChap } = await supabase
          .from('chapters')
          .select('id')
          .eq('series_id', vol.series_id)
          .eq('chapter_number', cNum)
          .single()

        let chapterId: string

        if (existingChap) {
          chapterId = existingChap.id
          // Optionally update existing chapter details if needed
          await supabase.from('chapters').update(chapterPayload).eq('id', chapterId)
        } else {
          const { data: newChap, error: chapError } = await supabase
            .from('chapters')
            .insert(chapterPayload)
            .select('id')
            .single()

          if (chapError || !newChap) {
            console.warn(`[warn] Failed to insert chapter ${cNum}:`, chapError?.message)
            continue
          }
          chapterId = newChap.id
        }

        // Link chapter to volume
        const { error: linkError } = await supabase
          .from('volume_chapters')
          .upsert({ volume_id: volumeId, chapter_id: chapterId }, { onConflict: 'volume_id,chapter_id' })

        if (linkError) {
          console.warn(`[warn] Failed to link chapter ${cNum} to volume ${vol.volume_number}:`, linkError.message)
        }
      }
    }
  }
  return inserted
}

/** Fetch all publishers from DB to seed the name→ID cache. */
export async function fetchPublishers(): Promise<{ name: string; id: string }[]> {
  const { data } = await supabase.from('publishers').select('id,name')
  return (data ?? []) as { name: string; id: string }[]
}
