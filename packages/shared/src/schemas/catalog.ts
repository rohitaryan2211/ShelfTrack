import { z } from 'zod';

export const ChapterSchema = z.object({
  chapter_number: z.number(),
  title: z.string().nullable().optional(),
  original_release_date: z.string().nullable().optional(),
});

export const VolumeSchema = z.object({
  volume_number: z.number(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional().default(null),
  publisher_slug: z.string().min(1),
  region_code: z.string().min(2),
  edition_type: z.enum(['single', 'omnibus', 'deluxe', 'digital_only']).default('single'),
  language_code: z.string().optional(),
  isbn: z.string().nullable().optional(),
  isbn13: z.string().nullable().optional(),
  release_date: z.string().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  page_count: z.number().nullable().optional(),
  ingest_status: z.enum(['draft', 'published', 'rejected']).default('published'),
  chapters: z.array(ChapterSchema).optional(),
}).transform((vol) => ({
  ...vol,
  language_code: vol.language_code || vol.region_code.toLowerCase(),
  isbn: vol.isbn || vol.isbn13 || null,
}));

export const SeriesCatalogSchema = z.object({
  $version: z.literal(2).default(2),
  series: z.object({
    title: z.string().min(1),
    original_title: z.string().nullable().optional(),
    type: z.enum(['manga', 'novel', 'light_novel']).default('manga'),
    genre: z.enum([
      'shonen', 'shojo', 'seinen', 'josei',
      'fantasy', 'romance', 'horror', 'sci_fi',
      'slice_of_life', 'action', 'comedy', 'other'
    ]).optional(),
    description: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    original_publisher_slug: z.string().min(1),
    status: z.enum(['ongoing', 'completed', 'hiatus']).default('ongoing'),
    cover_url: z.string().nullable().optional(),
    ingest_status: z.enum(['draft', 'published', 'rejected']).default('published'),
  }),
  volumes: z.array(VolumeSchema),
});

export type CatalogSeriesPayload = z.infer<typeof SeriesCatalogSchema>;
