/**
 * AniList GraphQL — free, no key. Rate limit is 30 requests/minute (degraded mode),
 * so requests are spaced ~2.2s apart. Each request returns up to 50 series, which
 * keeps a full weekly run to a handful of calls.
 * Docs: https://docs.anilist.co
 */
import { fetchJson } from '../http.ts'

const ENDPOINT = 'https://graphql.anilist.co'
const MIN_INTERVAL_MS = 2200

export interface AniListMedia {
  id: number
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  synonyms: string[]
  status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | null
  format: string | null
  countryOfOrigin: string | null
  volumes: number | null
  chapters: number | null
  genres: string[]
  popularity: number | null
  averageScore: number | null
  isAdult: boolean
  startDate: { year: number | null }
  coverImage: { extraLarge: string | null; large: string | null }
  description: string | null
  staff: { edges: { role: string; node: { name: { full: string | null } } }[] }
}

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  synonyms
  status format countryOfOrigin volumes chapters genres popularity averageScore isAdult
  startDate { year }
  coverImage { extraLarge large }
  description(asHtml: false)
  staff(perPage: 8, sort: RELEVANCE) { edges { role node { name { full } } } }
`

interface PageResponse {
  data: { Page: { pageInfo: { hasNextPage: boolean }; media: AniListMedia[] } }
}

async function query(gql: string, variables: Record<string, unknown>) {
  const res = await fetchJson<PageResponse>(ENDPOINT, {
    method: 'POST',
    body: { query: gql, variables },
    minIntervalMs: MIN_INTERVAL_MS,
  })
  if (!res?.data?.Page) throw new Error('AniList returned no data')
  return res.data.Page
}

const LIST_QUERY = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: MANGA, format: MANGA, isAdult: false, sort: $sort) { ${MEDIA_FIELDS} }
    }
  }
`

/** Top-N manga by the given sort (POPULARITY_DESC, TRENDING_DESC, ...). */
export async function listManga(sort: 'POPULARITY_DESC' | 'TRENDING_DESC', limit: number): Promise<AniListMedia[]> {
  const out: AniListMedia[] = []
  const perPage = 50
  for (let page = 1; out.length < limit; page++) {
    const result = await query(LIST_QUERY, { page, perPage, sort: [sort] })
    out.push(...result.media)
    if (!result.pageInfo.hasNextPage) break
  }
  return out.slice(0, limit)
}

const BY_ID_QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(id_in: $ids, type: MANGA) { ${MEDIA_FIELDS} }
    }
  }
`

/** Fetch specific series by AniList ID, 50 per request. */
export async function getMangaByIds(ids: number[]): Promise<AniListMedia[]> {
  const out: AniListMedia[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const result = await query(BY_ID_QUERY, { ids: chunk, perPage: 50 })
    out.push(...result.media)
  }
  return out
}

const SEARCH_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 5) {
      pageInfo { hasNextPage }
      media(search: $search, type: MANGA, format_in: [MANGA, ONE_SHOT]) { ${MEDIA_FIELDS} }
    }
  }
`

export async function searchManga(search: string): Promise<AniListMedia[]> {
  const result = await query(SEARCH_QUERY, { search })
  return result.media
}
