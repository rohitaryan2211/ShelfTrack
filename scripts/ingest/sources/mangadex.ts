const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

export interface MangaDexCover {
  volume: number
  url: string
}

const MANGADEX_API = 'https://api.mangadex.org'
const UPLOADS_CDN = 'https://uploads.mangadex.org'

/**
 * Searches MangaDex by title and retrieves the cover URLs mapped by volume number.
 * MangaDex explicitly stores covers by volume!
 */
export async function getMangaDexCovers(title: string): Promise<Record<number, string>> {
  try {
    // 1. Search for the manga by title
    const searchUrl = new URL(`${MANGADEX_API}/manga`)
    searchUrl.searchParams.set('title', title)
    searchUrl.searchParams.set('limit', '5')
    // We only want actual manga or manhwa
    searchUrl.searchParams.append('originalLanguage[]', 'ja')
    searchUrl.searchParams.append('originalLanguage[]', 'ko')

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) throw new Error(`MangaDex search failed: ${searchRes.statusText}`)
    
    const searchData = await searchRes.json()
    if (!searchData.data || searchData.data.length === 0) {
      return {} // Not found on MangaDex
    }

    // Pick the most relevant result (usually the first one)
    // We can try to exact match the english or romaji title if possible, but taking the first is usually fine.
    const mangaId = searchData.data[0].id

    await delay(250) // MangaDex rate limits (5 per second limit)

    // 2. Fetch all cover art for this manga
    const coverUrl = new URL(`${MANGADEX_API}/cover`)
    coverUrl.searchParams.set('manga[]', mangaId)
    coverUrl.searchParams.set('limit', '100') // Usually enough for most series
    
    const coverRes = await fetch(coverUrl.toString())
    if (!coverRes.ok) throw new Error(`MangaDex cover fetch failed: ${coverRes.statusText}`)
    
    const coverData = await coverRes.json()
    if (!coverData.data) return {}

    // 3. Map volume strings to image URLs
    const volumeCovers: Record<number, string> = {}

    for (const item of coverData.data) {
      const volStr = item.attributes?.volume
      const fileName = item.attributes?.fileName
      
      if (!volStr || !fileName) continue

      const volNum = parseFloat(volStr)
      if (isNaN(volNum)) continue

      // Use the high quality 512px thumbnail instead of original size (which can be huge)
      const imageUrl = `${UPLOADS_CDN}/covers/${mangaId}/${fileName}.512.jpg`
      
      // If there are multiple covers for a volume (e.g. alt covers), just keep the first one we find
      if (!volumeCovers[volNum]) {
        volumeCovers[volNum] = imageUrl
      }
    }

    return volumeCovers
  } catch (error) {
    console.warn(`[mangadex] Warning: Failed to fetch covers for "${title}" -`, error)
    return {}
  }
}
