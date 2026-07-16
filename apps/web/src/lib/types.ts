// ─────────────────────────────────────────────────────────
// Core catalog types (mirror the DB schema)
// ─────────────────────────────────────────────────────────

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
  description?: string
  original_publisher_id: string
  status: 'ongoing' | 'completed' | 'hiatus'
  cover_url?: string
  created_at: string
  ingest_status?: 'draft' | 'published' | 'rejected'
  // joined
  publisher?: Publisher
  volumes?: Volume[]
  _count?: { volumes: number; readers: number; owned: number }
  avg_rating?: number
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
export type OwnedFormat = 'physical' | 'digital' | 'both'

export interface LibraryEntry {
  id: string
  user_id: string
  volume_id?: string
  series_id?: string
  read_status: ReadStatus
  read_date?: string
  owned: boolean
  owned_date?: string
  owned_format?: OwnedFormat
  personal_rating?: number
  updated_at: string
  // joined
  volume?: Volume
  series?: Series
}

export interface Review {
  id: string
  user_id: string
  series_id?: string
  volume_id?: string
  body: string
  rating?: number
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
