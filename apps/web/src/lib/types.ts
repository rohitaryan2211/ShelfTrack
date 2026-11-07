// ─────────────────────────────────────────────────────────
// Core catalog types (mirror the DB schema)
// ─────────────────────────────────────────────────────────

export type SeriesGenre =
  | 'shonen' | 'shojo' | 'seinen' | 'josei'
  | 'fantasy' | 'romance' | 'horror' | 'sci_fi'
  | 'slice_of_life' | 'action' | 'comedy' | 'other'

export const GENRE_LABELS: Record<SeriesGenre, string> = {
  shonen: 'Shōnen',
  shojo: 'Shōjo',
  seinen: 'Seinen',
  josei: 'Josei',
  fantasy: 'Fantasy',
  romance: 'Romance',
  horror: 'Horror',
  sci_fi: 'Sci-Fi',
  slice_of_life: 'Slice of Life',
  action: 'Action',
  comedy: 'Comedy',
  other: 'Other',
}

export interface Publisher {
  id: string
  name: string
  country: string
  website?: string
  is_original_publisher: boolean
}

export interface Series {
  id: string
  title: string
  original_title?: string
  type: 'manga' | 'novel' | 'light_novel'
  genre?: SeriesGenre
  description?: string
  author?: string
  original_publisher_id: string
  status: 'ongoing' | 'completed' | 'hiatus'
  cover_url?: string
  created_at: string
  ingest_status?: 'draft' | 'published' | 'rejected'
  // populated by the catalog sync
  anilist_id?: number | null
  popularity?: number | null
  average_score?: number | null
  volume_count?: number | null
  chapter_count?: number | null
  start_year?: number | null
  genres?: string[]
  source?: 'manual' | 'sync'
  last_synced_at?: string | null
  // joined
  publisher?: Publisher
  volumes?: Volume[]
  stats?: SeriesStats | null
}

/** Row of the series_stats view — live community counts. */
export interface SeriesStats {
  series_id: string
  readers: number
  completed: number
  avg_rating: number | null
  owners: number
}

export interface SyncRun {
  id: string
  started_at: string
  finished_at: string | null
  mode: string
  status: 'running' | 'success' | 'partial' | 'failed'
  series_checked: number
  series_added: number
  series_updated: number
  volumes_added: number
  chapters_added: number
  errors: { series: string; error: string }[]
}

export interface Volume {
  id: string
  series_id: string
  volume_number: number
  title?: string
  isbn13?: string
  publisher_id: string
  region_code: string
  release_date?: string
  cover_url?: string
  page_count?: number
  ingest_status?: 'draft' | 'published' | 'rejected'
  // joined
  publisher?: Publisher
  series?: Series
  chapters?: Chapter[]
}

export interface Chapter {
  id: string
  series_id: string
  chapter_number: number
  title?: string
  original_release_date?: string
}

export interface Region {
  code: string
  name: string
}

export interface Retailer {
  id: string
  name: string
  region_code: string
  base_url?: string
}

export interface VolumeAvailability {
  id: string
  volume_id: string
  retailer_id: string
  region_code: string
  product_url?: string
  in_print?: boolean
  last_verified_at?: string
  retailer?: Retailer
  region?: Region
}

// ─────────────────────────────────────────────────────────
// User / Library types
// ─────────────────────────────────────────────────────────

export interface Profile {
  id: string
  username: string
  avatar_url?: string
  bio?: string
  created_at: string
}

export type ReadStatus = 'plan_to_read' | 'reading' | 'completed' | 'dropped' | 'on_hold'
export type CollectionStatus = 'owned' | 'wishlist'
export type OwnedFormat = 'physical' | 'digital' | 'both'
export type EditionType = 'single' | 'omnibus' | 'deluxe' | 'digital_only'

export interface UserChapterRead {
  id: string
  user_id: string
  chapter_id: string
  read_at: string
}

export interface Volume {
  id: string
  series_id: string
  volume_number: number
  title?: string
  description?: string | null
  isbn13?: string
  isbn?: string
  language_code?: string
  edition_type?: EditionType
  publisher_id: string
  region_code: string
  release_date?: string
  cover_url?: string
  page_count?: number
  ingest_status?: 'draft' | 'published' | 'rejected'
  // joined
  publisher?: Publisher
  series?: Series
  chapters?: Chapter[]
}

export interface LibraryEntry {
  id: string
  user_id: string
  volume_id?: string
  series_id?: string
  read_status?: ReadStatus | null
  read_date?: string
  owned: boolean
  owned_date?: string
  owned_format?: OwnedFormat
  collection_status?: CollectionStatus | null
  personal_rating?: number | null
  updated_at: string
  // joined
  volume?: Volume
  series?: Series
}

export interface ActivityFeedItem {
  id: string
  user_id: string
  event_type: 'completed_volume' | 'completed_series' | 'chapter_logged' | 'review_published'
  series_id?: string
  volume_id?: string
  review_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  user_profile?: Profile
  series?: Series
  volume?: Volume
  review?: Review
  likes_count?: number
  comments_count?: number
}

export interface Review {
  id: string
  user_id: string
  series_id?: string
  volume_id?: string
  body: string
  rating?: number | null
  contains_spoilers: boolean
  created_at: string
  // joined
  profile?: Profile
  series?: Series
  volume?: Volume
}

// ─────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────

export const READ_STATUS_LABELS: Record<ReadStatus, string> = {
  plan_to_read: 'Plan to Read',
  reading: 'Reading',
  completed: 'Completed',
  dropped: 'Dropped',
  on_hold: 'On Hold',
}

export const READ_STATUS_COLORS: Record<ReadStatus, string> = {
  plan_to_read: 'badge-neutral',
  reading: 'badge-slate',
  completed: 'badge-ink-green',
  dropped: 'badge-neutral',
  on_hold: 'badge-ochre',
}

