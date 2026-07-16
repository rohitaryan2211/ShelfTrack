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
    return null
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
  if (dryRun) {
    console.log(`[dry-run] Would upsert ${volumes.length} volumes for series ${volumes[0]?.series_id}`)
    return 0
  }

  let inserted = 0
  for (const vol of volumes) {
    const { error } = await supabase
      .from('volumes')
      .upsert(vol, { onConflict: 'series_id,volume_number,region_code' })

    if (error) {
      console.warn(`[warn] Volume ${vol.volume_number} upsert failed:`, error.message)
    } else {
      inserted++
    }
  }
  return inserted
}

/** Fetch all publishers from DB to seed the name→ID cache. */
export async function fetchPublishers(): Promise<{ name: string; id: string }[]> {
  const { data } = await supabase.from('publishers').select('id,name')
  return (data ?? []) as { name: string; id: string }[]
}
