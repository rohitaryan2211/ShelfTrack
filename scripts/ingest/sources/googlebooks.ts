/**
 * Google Books API client
 * API: https://www.googleapis.com/books/v1/
 * Free tier — requires API key (no credit card needed).
 * Set GOOGLE_BOOKS_API_KEY in your .env
 */

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? ''
const BASE = 'https://www.googleapis.com/books/v1'

export interface GoogleBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    industryIdentifiers?: { type: string; identifier: string }[]
    pageCount?: number
    imageLinks?: { thumbnail: string; smallThumbnail: string }
    description?: string
    language?: string
  }
}

export interface GoogleBooksResponse {
  totalItems: number
  items?: GoogleBook[]
}

export async function searchBooks(query: string, maxResults = 5): Promise<GoogleBook[]> {
  if (!API_KEY) {
    console.warn('[google-books] No API key set — skipping ISBN lookup')
    return []
  }
  const url = new URL(`${BASE}/volumes`)
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('key', API_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) return []
  const json: GoogleBooksResponse = await res.json()
  return json.items ?? []
}

export function extractISBN13(book: GoogleBook): string | null {
  return book.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier ?? null
}

export function extractISBN10(book: GoogleBook): string | null {
  return book.volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier ?? null
}

/** Search for a specific manga volume and return its ISBN */
export async function getVolumeISBN(seriesTitle: string, volumeNumber: number): Promise<string | null> {
  const results = await searchBooks(`${seriesTitle} volume ${volumeNumber} manga`, 5)
  if (!results.length) return null
  // Prefer results where the title contains the volume number
  const best = results.find(r => r.volumeInfo.title.toLowerCase().includes(`vol`)) ?? results[0]
  return extractISBN13(best) ?? extractISBN10(best) ?? null
}
