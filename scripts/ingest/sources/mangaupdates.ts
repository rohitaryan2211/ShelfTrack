/**
 * MangaUpdates API client
 * API: https://api.mangaupdates.com/v1/
 * Free, no key required.
 */

const MANGAUPDATES_API = 'https://api.mangaupdates.com/v1'

export interface MUSeriesInfo {
  series_id: number
  title: string
  description: string
  type: string
  year: string
  status: string
  image: { url: { original: string } }
  publishers: { publisher_name: string; type: string }[]
  latest_chapter: number | null
  associated: { title: string }[]
}

export interface MUSearchResult {
  hit_title: string
  record: { series_id: number; title: string; year: string; type: string }
}

export async function searchSeries(query: string, page = 1, perPage = 10): Promise<MUSearchResult[]> {
  const res = await fetch(`${MANGAUPDATES_API}/series/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: query, page, perpage: perPage }),
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.results ?? []
}

export async function getSeriesById(id: number): Promise<MUSeriesInfo | null> {
  const res = await fetch(`${MANGAUPDATES_API}/series/${id}`)
  if (!res.ok) return null
  return res.json()
}

/** Extract publisher info from MU series */
export function getOriginalPublisher(info: MUSeriesInfo): string | null {
  const original = info.publishers.find(p => p.type === 'Original Publisher')
  return original?.publisher_name ?? null
}
