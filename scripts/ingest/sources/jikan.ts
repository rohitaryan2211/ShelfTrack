/**
 * Jikan REST API client (MyAnimeList wrapper)
 * API: https://api.jikan.moe/v4
 * Rate limit: 3 requests/second, 60 requests/minute.
 */

const JIKAN_API = 'https://api.jikan.moe/v4'

export interface JikanManga {
  mal_id: number
  url: string
  images: { jpg: { image_url: string; large_image_url: string } }
  title: string
  title_english: string | null
  title_japanese: string | null
  type: string
  volumes: number | null
  chapters: number | null
  status: string
  synopsis: string | null
  score: number | null
}

export async function searchMangaByTitleJikan(query: string, limit = 1): Promise<{ series: JikanManga[] }> {
  // Respect Jikan rate limits
  await new Promise(r => setTimeout(r, 1000))

  const url = new URL(`${JIKAN_API}/manga`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', limit.toString())

  const res = await fetch(url.toString())
  if (!res.ok) {
    if (res.status === 429) throw new Error('Jikan API rate limit exceeded')
    throw new Error(`Jikan API error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return { series: json.data as JikanManga[] }
}

export async function getMangaByIdJikan(id: number): Promise<JikanManga> {
  await new Promise(r => setTimeout(r, 1000))
  
  const res = await fetch(`${JIKAN_API}/manga/${id}`)
  if (!res.ok) {
    throw new Error(`Jikan API error: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return json.data as JikanManga
}
