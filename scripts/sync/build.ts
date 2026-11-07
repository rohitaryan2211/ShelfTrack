/**
 * Combine AniList + MangaDex + MangaUpdates into one SeriesBundle.
 * Network only — no database access — so it works in --dry-run.
 */
import type { AniListMedia } from './sources/anilist.ts'
import * as mangadex from './sources/mangadex.ts'
import * as mangaupdates from './sources/mangaupdates.ts'
import {
  mapStatus, mapGenre, cleanDescription, pickAuthor, pickTitle, searchTitles,
  countryToRegion, regionLanguage, resolveChapterVolumes, chapterNumbers,
  pickEnglishLicensor, pickOriginalPublisher, type Licensor, type SeriesGenre, type SeriesStatus,
} from './map.ts'

export interface SeriesFields {
  anilist_id: number
  mal_id: number | null
  mangadex_id: string | null
  mangaupdates_id: number | null
  title: string
  original_title: string | null
  type: 'manga'
  genre: SeriesGenre
  genres: string[]
  description: string | null
  author: string | null
  status: SeriesStatus
  cover_url: string | null
  popularity: number | null
  average_score: number | null
  volume_count: number | null
  chapter_count: number | null
  start_year: number | null
}

export interface VolumeSpec {
  region_code: string
  language_code: string
  volume_number: number
  cover_url: string | null
  publisherName: string | null
  publisherCountry: string
  isOriginalPublisher: boolean
}

export interface SeriesBundle {
  series: SeriesFields
  originalPublisher: string | null
  originRegion: string
  englishLicensor: Licensor | null
  volumes: VolumeSpec[]
  chapters: number[]
  /** chapter number → volume number (original-language numbering) */
  chapterVolume: Map<number, number>
}

/** Metadata that AniList alone provides — enough for a cheap weekly refresh. */
export function seriesFieldsFromAniList(media: AniListMedia): SeriesFields {
  return {
    anilist_id: media.id,
    mal_id: media.idMal,
    mangadex_id: null,
    mangaupdates_id: null,
    title: pickTitle(media),
    original_title: media.title.native?.trim() || null,
    type: 'manga',
    genre: mapGenre(null, media.genres ?? []),
    genres: media.genres ?? [],
    description: cleanDescription(media.description),
    author: pickAuthor(media),
    status: mapStatus(media.status),
    cover_url: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    popularity: media.popularity,
    average_score: media.averageScore,
    volume_count: media.volumes,
    chapter_count: media.chapters,
    start_year: media.startDate?.year ?? null,
  }
}

export async function buildBundle(media: AniListMedia): Promise<SeriesBundle> {
  const series = seriesFieldsFromAniList(media)
  const originRegion = countryToRegion(media.countryOfOrigin)

  // 1. MangaDex: exact match through the AniList link MangaDex stores
  const md = await mangadex.findByAniListId(media.id, searchTitles(media))
  let jaCovers = new Map<number, string>()
  let enCovers = new Map<number, string>()
  let chapterVolume = new Map<number, number>()
  let knownChapters: number[] = []

  if (md) {
    series.mangadex_id = md.id
    series.genre = mapGenre(md.attributes.publicationDemographic, media.genres ?? [])
    series.mangaupdates_id = mangadex.mangaUpdatesIdFromLink(md.attributes.links?.mu)

    const covers = await mangadex.getVolumeCovers(md.id)
    jaCovers = covers.ja
    enCovers = covers.en

    const votes = await mangadex.getChapterVolumeVotes(md.id)
    chapterVolume = resolveChapterVolumes(votes)
    knownChapters = [...new Set(votes.map(v => v.chapter))]
  }

  // 2. MangaUpdates: publishers + English licensor volume count
  let originalPublisher: string | null = null
  let englishLicensor: Licensor | null = null
  let muLatestChapter: number | null = null
  if (series.mangaupdates_id) {
    const mu = await mangaupdates.getSeries(series.mangaupdates_id)
    if (mu) {
      originalPublisher = pickOriginalPublisher(mu.publishers ?? [])
      englishLicensor = pickEnglishLicensor(mu.publishers ?? [])
      muLatestChapter = mu.latest_chapter
      if (!series.author) {
        const names = [...new Set((mu.authors ?? []).map(a => a.name))]
        series.author = names.length ? names.slice(0, 3).join(', ') : null
      }
    }
  }

  // 3. Volume count: the largest number any source can vouch for
  const volumeCount = Math.max(
    media.volumes ?? 0,
    ...[...jaCovers.keys()].filter(Number.isInteger),
    ...[...chapterVolume.values()].filter(Number.isInteger),
  )
  series.volume_count = volumeCount > 0 ? volumeCount : null

  // 4. Chapters
  const maxChapter = media.chapters ?? muLatestChapter ?? (knownChapters.length ? Math.max(...knownChapters) : null)
  const chapters = chapterNumbers(maxChapter ? Math.floor(maxChapter) : null, knownChapters)
  series.chapter_count = media.chapters ?? (chapters.length ? Math.floor(Math.max(...chapters)) : null)

  // 5. Volume rows: original-language edition, plus the English edition when licensed
  const volumes: VolumeSpec[] = []
  for (let n = 1; n <= volumeCount; n++) {
    volumes.push({
      region_code: originRegion,
      language_code: regionLanguage(originRegion),
      volume_number: n,
      cover_url: jaCovers.get(n) ?? null,
      publisherName: originalPublisher,
      publisherCountry: originRegion,
      isOriginalPublisher: true,
    })
  }
  if (englishLicensor) {
    for (let n = 1; n <= englishLicensor.volumes; n++) {
      volumes.push({
        region_code: 'US',
        language_code: 'en',
        volume_number: n,
        cover_url: enCovers.get(n) ?? jaCovers.get(n) ?? null,
        publisherName: englishLicensor.name,
        publisherCountry: 'US',
        isOriginalPublisher: false,
      })
    }
  }

  return { series, originalPublisher, originRegion, englishLicensor, volumes, chapters, chapterVolume }
}
