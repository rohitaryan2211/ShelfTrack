/**
 * Pure mapping from source API shapes to ShelfTrack's schema.
 * No I/O here, so everything is covered by map.test.ts.
 */
import type { AniListMedia } from './sources/anilist.ts'
import type { MUPublisher } from './sources/mangaupdates.ts'

export type SeriesStatus = 'ongoing' | 'completed' | 'hiatus'
export type SeriesGenre =
  | 'shonen' | 'shojo' | 'seinen' | 'josei' | 'fantasy' | 'romance' | 'horror'
  | 'sci_fi' | 'slice_of_life' | 'action' | 'comedy' | 'other'

export function mapStatus(status: AniListMedia['status']): SeriesStatus {
  switch (status) {
    case 'FINISHED':
    case 'CANCELLED':
      return 'completed'
    case 'HIATUS':
      return 'hiatus'
    default:
      return 'ongoing'
  }
}

const DEMOGRAPHIC_GENRE: Record<string, SeriesGenre> = {
  shounen: 'shonen',
  shoujo: 'shojo',
  seinen: 'seinen',
  josei: 'josei',
}

// Order matters: the first AniList genre found in this list wins.
const ANILIST_GENRE_PRIORITY: [string, SeriesGenre][] = [
  ['Romance', 'romance'],
  ['Horror', 'horror'],
  ['Sci-Fi', 'sci_fi'],
  ['Mecha', 'sci_fi'],
  ['Fantasy', 'fantasy'],
  ['Slice of Life', 'slice_of_life'],
  ['Action', 'action'],
  ['Comedy', 'comedy'],
]

/** The DB stores one primary genre; demographic is the most useful single label for manga. */
export function mapGenre(demographic: string | null | undefined, anilistGenres: string[]): SeriesGenre {
  if (demographic && DEMOGRAPHIC_GENRE[demographic]) return DEMOGRAPHIC_GENRE[demographic]
  for (const [name, genre] of ANILIST_GENRE_PRIORITY) {
    if (anilistGenres.includes(name)) return genre
  }
  return 'other'
}

/** Strip HTML, source credits and trailing "Notes:" blocks from AniList descriptions. */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

  text = text.replace(/\n\s*Notes?:[\s\S]*$/i, '')
  text = text.replace(/\(\s*Source:[^)]*\)/gi, '')
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text.length > 0 ? text : null
}

const AUTHOR_ROLE = /^(story\s*&\s*art|story|art|original\s+(creator|story))$/i

/** "Story & Art" first, then story writers, then artists — unique, comma separated. */
export function pickAuthor(media: Pick<AniListMedia, 'staff'>): string | null {
  const edges = media.staff?.edges ?? []
  const ranked = edges
    .map(e => ({ role: e.role.replace(/\s*\(.*\)\s*$/, '').trim(), name: e.node.name.full?.trim() }))
    .filter((e): e is { role: string; name: string } => !!e.name && AUTHOR_ROLE.test(e.role))
    .sort((a, b) => rank(a.role) - rank(b.role))

  const names = [...new Set(ranked.map(e => e.name))]
  return names.length ? names.slice(0, 3).join(', ') : null

  function rank(role: string) {
    if (/story\s*&\s*art/i.test(role)) return 0
    if (/^(story|original)/i.test(role)) return 1
    return 2
  }
}

export function pickTitle(media: Pick<AniListMedia, 'title'>): string {
  return (media.title.english || media.title.romaji || media.title.native || 'Untitled').trim()
}

/** Titles to try when searching other sources, most specific first. */
export function searchTitles(media: Pick<AniListMedia, 'title' | 'synonyms'>): string[] {
  return [media.title.romaji, media.title.english, ...(media.synonyms ?? []).slice(0, 2)]
    .filter((t): t is string => !!t && t.trim().length > 0)
}

export function countryToRegion(country: string | null | undefined): string {
  return country && ['JP', 'KR', 'CN', 'TW'].includes(country) ? country : 'JP'
}

export function regionLanguage(region: string): string {
  return { JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh' }[region] ?? 'en'
}

// MangaUpdates uses imprint names and short forms; fold them into one publisher row each.
const PUBLISHER_ALIASES: Record<string, string> = {
  viz: 'Viz Media',
  viz_media: 'Viz Media',
  viz_llc: 'Viz Media',
  shonen_sunday: 'Viz Media',
  shonen_jump: 'Viz Media',
  vizbig: 'Viz Media',
  kodansha_comics: 'Kodansha USA',
  kodansha_usa: 'Kodansha USA',
  kodansha_international: 'Kodansha USA',
  vertical: 'Kodansha USA',
  yen_press: 'Yen Press',
  yen_on: 'Yen Press',
  seven_seas: 'Seven Seas',
  seven_seas_entertainment: 'Seven Seas',
  ghost_ship: 'Seven Seas',
  square_enix_manga_books: 'Square Enix Manga & Books',
  shueisha_inc: 'Shueisha',
  kodansha_ltd: 'Kodansha',
  shogakukan_inc: 'Shogakukan',
}

export function canonicalPublisherName(name: string): string {
  const trimmed = name.trim()
  return PUBLISHER_ALIASES[slugify(trimmed)] ?? trimmed
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Resolve chapter → volume from MangaDex aggregate votes.
 *
 * Votes are noisy: licensed chapters get removed, and some uploads carry the wrong
 * volume tag (e.g. chapter 232 tagged as volume 1). We take the most-voted volume
 * per chapter, then keep only assignments that form the longest non-decreasing
 * run of volumes in chapter order — volumes never go backwards as chapters advance.
 */
export function resolveChapterVolumes(votes: { chapter: number; volume: number | null; count: number }[]): Map<number, number> {
  const tally = new Map<number, Map<number, number>>()
  for (const v of votes) {
    if (v.volume === null) continue
    const perChapter = tally.get(v.chapter) ?? new Map<number, number>()
    perChapter.set(v.volume, (perChapter.get(v.volume) ?? 0) + Math.max(1, v.count))
    tally.set(v.chapter, perChapter)
  }

  const pairs = [...tally.entries()]
    .map(([chapter, counts]) => {
      let best = -1
      let bestCount = -1
      for (const [vol, count] of counts) {
        if (count > bestCount || (count === bestCount && vol < best)) { best = vol; bestCount = count }
      }
      return { chapter, volume: best }
    })
    .sort((a, b) => a.chapter - b.chapter)

  // Longest non-decreasing subsequence on volume, O(n log n) with predecessor links.
  const tailIdx: number[] = []
  const prev = new Array<number>(pairs.length).fill(-1)
  for (let i = 0; i < pairs.length; i++) {
    const vol = pairs[i].volume
    let lo = 0
    let hi = tailIdx.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pairs[tailIdx[mid]].volume <= vol) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prev[i] = tailIdx[lo - 1]
    tailIdx[lo] = i
  }

  const result = new Map<number, number>()
  for (let i = tailIdx.length ? tailIdx[tailIdx.length - 1] : -1; i !== -1; i = prev[i]) {
    result.set(pairs[i].chapter, pairs[i].volume)
  }
  return result
}

/** Every chapter number we should store: 1..max, plus any decimal chapters MangaDex knows. */
export function chapterNumbers(maxChapter: number | null, known: Iterable<number>, cap = 3000): number[] {
  const set = new Set<number>()
  const max = Math.min(Math.floor(maxChapter ?? 0), cap)
  for (let i = 1; i <= max; i++) set.add(i)
  for (const c of known) if (c > 0 && c <= cap) set.add(c)
  return [...set].sort((a, b) => a - b)
}

export interface Licensor {
  name: string
  volumes: number
}

const OMNIBUS = /omnibus|\d\s*-?\s*in\s*-?\s*\d|deluxe|collector|box\s*set/i

/** Pick the English print licensor with the most single volumes from MangaUpdates notes. */
export function pickEnglishLicensor(publishers: MUPublisher[]): Licensor | null {
  let best: Licensor | null = null
  for (const p of publishers) {
    if (p.type !== 'English' || !p.notes) continue
    // Notes can list several editions: "111 Volumes; Ongoing | 35 3-in-1 Omnibuses; Ongoing"
    for (const segment of p.notes.split('|')) {
      if (OMNIBUS.test(segment)) continue
      const match = segment.match(/(\d+)\s*Vol(ume)?s?\b/i)
      if (!match) continue
      const volumes = parseInt(match[1], 10)
      if (volumes > 0 && volumes < 500 && (!best || volumes > best.volumes)) {
        best = { name: canonicalPublisherName(p.publisher_name), volumes }
      }
    }
  }
  return best
}

export function pickOriginalPublisher(publishers: MUPublisher[]): string | null {
  const original = publishers.find(p => p.type === 'Original')
  return original ? canonicalPublisherName(original.publisher_name) : null
}
