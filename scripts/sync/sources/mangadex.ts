/**
 * MangaDex API — free, no key; ~5 req/s global limit (we stay well under it).
 * Used for: exact AniList → MangaDex matching (via attributes.links.al), the
 * publication demographic, per-volume cover art, and the chapter → volume map.
 * Docs: https://api.mangadex.org/docs/
 */
import { fetchJson } from '../http.ts'

const API = 'https://api.mangadex.org'
const CDN = 'https://uploads.mangadex.org'
const MIN_INTERVAL_MS = 350

export interface MangaDexManga {
  id: string
  attributes: {
    title: Record<string, string>
    altTitles: Record<string, string>[]
    links: Record<string, string> | null
    publicationDemographic: 'shounen' | 'shoujo' | 'seinen' | 'josei' | null
    status: string
    lastVolume: string | null
    lastChapter: string | null
  }
}

interface ListResponse<T> { data: T[]; total: number; limit: number; offset: number }

/** Find the MangaDex entry that MangaDex itself links to the given AniList ID. */
export async function findByAniListId(anilistId: number, titles: string[]): Promise<MangaDexManga | null> {
  const tried = new Set<string>()
  for (const title of titles) {
    const key = title.trim().toLowerCase()
    if (!key || tried.has(key)) continue
    tried.add(key)

    const url = new URL(`${API}/manga`)
    url.searchParams.set('title', title)
    url.searchParams.set('limit', '20')
    for (const rating of ['safe', 'suggestive', 'erotica']) url.searchParams.append('contentRating[]', rating)

    const res = await fetchJson<ListResponse<MangaDexManga>>(url.toString(), { minIntervalMs: MIN_INTERVAL_MS })
    const hit = res?.data.find(m => m.attributes.links?.al === String(anilistId))
    if (hit) return hit
  }
  return null
}

/** Volume number → cover URL. Prefers the Japanese cover; falls back to any locale. */
export async function getVolumeCovers(mangaId: string): Promise<{ ja: Map<number, string>; en: Map<number, string> }> {
  const ja = new Map<number, string>()
  const en = new Map<number, string>()
  const other = new Map<number, string>()

  for (let offset = 0; ; offset += 100) {
    const url = new URL(`${API}/cover`)
    url.searchParams.append('manga[]', mangaId)
    url.searchParams.set('limit', '100')
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('order[volume]', 'asc')
    const res = await fetchJson<ListResponse<{ attributes: { volume: string | null; fileName: string; locale: string | null } }>>(
      url.toString(), { minIntervalMs: MIN_INTERVAL_MS },
    )
    if (!res) break

    for (const c of res.data) {
      const vol = Number(c.attributes.volume)
      if (!c.attributes.volume || !Number.isFinite(vol) || vol <= 0) continue
      const coverUrl = `${CDN}/covers/${mangaId}/${c.attributes.fileName}.512.jpg`
      const target = c.attributes.locale === 'ja' ? ja : c.attributes.locale === 'en' ? en : other
      if (!target.has(vol)) target.set(vol, coverUrl)
    }
    if (res.offset + res.limit >= res.total) break
  }

  for (const [vol, url] of other) if (!ja.has(vol)) ja.set(vol, url)
  return { ja, en }
}

interface AggregateResponse {
  volumes: Record<string, { volume: string; chapters: Record<string, { chapter: string; count: number }> }>
}

/**
 * Raw chapter → volume votes across every upload language.
 * Returns pairs of (chapter, volume|null, uploads). Interpretation lives in map.ts.
 */
export async function getChapterVolumeVotes(mangaId: string): Promise<{ chapter: number; volume: number | null; count: number }[]> {
  const res = await fetchJson<AggregateResponse>(`${API}/manga/${mangaId}/aggregate`, { minIntervalMs: MIN_INTERVAL_MS })
  if (!res?.volumes) return []
  const votes: { chapter: number; volume: number | null; count: number }[] = []
  for (const vol of Object.values(res.volumes)) {
    const volume = vol.volume === 'none' ? null : Number(vol.volume)
    for (const ch of Object.values(vol.chapters)) {
      const chapter = Number(ch.chapter)
      if (!Number.isFinite(chapter) || chapter <= 0) continue
      votes.push({ chapter, volume: volume !== null && Number.isFinite(volume) && volume > 0 ? volume : null, count: ch.count ?? 1 })
    }
  }
  return votes
}

/** MangaDex stores MangaUpdates IDs as base-36 strings; the MU API uses the decimal form. */
export function mangaUpdatesIdFromLink(link: string | undefined): number | null {
  if (!link || !/^[0-9a-z]+$/i.test(link)) return null
  const id = parseInt(link, 36)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
