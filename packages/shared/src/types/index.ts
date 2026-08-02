export type ReadFormat = 'physical' | 'digital' | 'scanlation';

export type ReadStatus = 'plan_to_read' | 'reading' | 'completed' | 'dropped' | 'on_hold';

export type OwnedFormat = 'physical' | 'digital' | 'both';

export type EditionType = 'single' | 'omnibus' | 'deluxe' | 'digital_only';

export type IngestStatus = 'draft' | 'published';

export interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

export interface UserChapterRead {
  id: string;
  user_id: string;
  chapter_id: string;
  read_format: ReadFormat;
  read_at: string;
}

export interface VolumeVariant {
  id: string;
  series_id: string;
  volume_number: number;
  title?: string;
  description?: string | null;
  isbn?: string;
  language_code: string;
  edition_type: EditionType;
  cover_image_url?: string;
  release_date?: string;
  ingest_status: IngestStatus;
}

export interface Retailer {
  id: string;
  name: string;
  region_code: string;
  base_url?: string;
}

export interface VolumeAvailability {
  id: string;
  volume_id: string;
  retailer_id: string;
  region_code: string;
  product_url?: string;
  in_print?: boolean;
  last_verified_at?: string;
}

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  event_type: 'completed_volume' | 'completed_series' | 'chapter_logged' | 'review_published';
  series_id?: string;
  volume_id?: string;
  review_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  user_profile?: UserProfile;
  likes_count?: number;
  comments_count?: number;
}
