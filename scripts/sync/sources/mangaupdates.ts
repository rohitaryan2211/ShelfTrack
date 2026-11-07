/**
 * MangaUpdates API — free, no key. Used for publishers: the original Japanese
 * publisher and English licensors, whose notes usually include a volume count
 * (e.g. "VIZ Media — 21 Volumes; Ongoing").
 * Docs: https://api.mangaupdates.com
 */
import { fetchJson } from '../http.ts'

const API = 'https://api.mangaupdates.com/v1'
const MIN_INTERVAL_MS = 1000

export interface MUPublisher {
  publisher_name: string
  publisher_id: number
  type: 'Original' | 'English' | string
  notes: string | null
}

export interface MUSeries {
  series_id: number
  title: string
  status: string | null
  latest_chapter: number | null
  completed: boolean
  publishers: MUPublisher[]
  authors: { name: string; type: string }[]
}

export async function getSeries(id: number): Promise<MUSeries | null> {
  return fetchJson<MUSeries>(`${API}/series/${id}`, { minIntervalMs: MIN_INTERVAL_MS, allow404: true })
}
