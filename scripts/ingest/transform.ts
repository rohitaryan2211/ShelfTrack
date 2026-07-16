/**
 * Transform API responses from AniList / MangaUpdates / Google Books
 * into our Supabase database schema shapes.
 */

import type { MUSeriesInfo } from './sources/mangaupdates.ts'

// ── Publisher name → ID lookup (populated from DB at script start) ──
const PUBLISHER_ID_CACHE: Record<string, string> = {}

export function seedPublisherCache(entries: { name: string; id: string }[]) {
  for (const e of entries) PUBLISHER_ID_CACHE[e.name.toLowerCase()] = e.id
}

export function lookupPublisherId(name: string): string | null {
  return PUBLISHER_ID_CACHE[name.toLowerCase()] ?? null
}

// ── Series transformer ──────────────────────────────────────────────
export interface SeriesInsert {
  title: string
  original_title: string | null
  type: 'manga' | 'novel' | 'light_novel'
  description: string | null
  original_publisher_id: string | null
  status: 'ongoing' | 'completed' | 'hiatus'
  cover_url: string | null
  ingest_status: 'draft' | 'published'
  _mal_id?: number            // fallback ID
}

export function transformMUSeries(
  s: MUSeriesInfo,
  publisherId: string | null,
  ingestStatus: 'draft' | 'published' = 'draft',
): SeriesInsert {
  let status: 'ongoing' | 'completed' | 'hiatus' = 'ongoing'
  if (s.status?.toLowerCase().includes('complete')) status = 'completed'
  else if (s.status?.toLowerCase().includes('hiatus')) status = 'hiatus'

  return {
    title: s.title,
    original_title: s.associated?.[0]?.title ?? null,
    type: s.type?.toLowerCase().includes('novel') ? 'light_novel' : 'manga',
    description: s.description ? s.description.replace(/<[^>]+>/g, '') : null,
    original_publisher_id: publisherId,
    status,
    cover_url: s.image?.url?.original ?? null,
    ingest_status: ingestStatus,
  }
}

export function extractMUVolumes(statusStr: string): number {
  const match = statusStr.match(/(\d+)\s+Volumes?/i)
  return match ? parseInt(match[1]) : 1
}

// ── Volume transformer ──────────────────────────────────────────────
export interface VolumeInsert {
  series_id: string
  volume_number: number
  publisher_id: string | null
  region_code: string
  cover_url: string | null
  isbn13: string | null
  release_date: string | null
  ingest_status: 'draft' | 'published'
}

export function buildVolumeInserts(
  seriesId: string,
  publisherId: string | null,
  totalVolumes: number,
  coverUrl: string | null,
  ingestStatus: 'draft' | 'published' = 'draft',
  mangadexCovers?: Record<number, string>
): VolumeInsert[] {
  return Array.from({ length: totalVolumes }, (_, i) => {
    const volNum = i + 1
    return {
      series_id: seriesId,
      volume_number: volNum,
      publisher_id: publisherId,
      region_code: 'JP',
      cover_url: mangadexCovers?.[volNum] ?? coverUrl,
      isbn13: null,
      release_date: null,
      ingest_status: ingestStatus,
    }
  })
}
