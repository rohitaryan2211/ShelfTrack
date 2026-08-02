export * from './catalog.js';

export const READ_FORMATS = ['physical', 'digital', 'scanlation'] as const;
export const READ_STATUSES = ['plan_to_read', 'reading', 'completed', 'dropped', 'on_hold'] as const;
export const OWNED_FORMATS = ['physical', 'digital', 'both'] as const;
export const EDITION_TYPES = ['single', 'omnibus', 'deluxe', 'digital_only'] as const;


export interface IngestDraftPayload {
  series_slug: string;
  title: string;
  japanese_title?: string;
  synopsis?: string;
  genres?: string[];
  publisher_id?: string;
  volumes: Array<{
    volume_number: number;
    title?: string;
    isbn?: string;
    language_code?: string;
    edition_type?: typeof EDITION_TYPES[number];
    chapters?: number[];
  }>;
}
