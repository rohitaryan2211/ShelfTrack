#!/usr/bin/env tsx
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import * as fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VETTED_DIR = resolve(__dirname, '../../data/vetted')

async function migrate() {
  console.log(`\n📦 ShelfTrack Data Migration Script (v1 -> v2)`)
  console.log(`   Target Directory: ${VETTED_DIR}`)

  if (!fs.existsSync(VETTED_DIR)) {
    console.log(`No vetted data found at ${VETTED_DIR}`)
    return
  }

  const seriesDirs = fs.readdirSync(VETTED_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  let migratedCount = 0

  for (const dirName of seriesDirs) {
    const dataPath = join(VETTED_DIR, dirName, 'data.json')
    if (!fs.existsSync(dataPath)) continue

    try {
      const raw = fs.readFileSync(dataPath, 'utf-8')
      const payload = JSON.parse(raw)

      console.log(`  🔄 Migrating/formatting "${dirName}" to v2...`)

      const series = payload.series || {}
      const volumes = payload.volumes || []

      const v2Payload = {
        $version: 2,
        series: {
          title: series.title,
          original_title: series.original_title || null,
          type: series.type || 'manga',
          genre: series.genre || 'shonen',
          description: series.description || null,
          original_publisher_slug: series.original_publisher_slug || series.original_publisher_name || 'shueisha',
          status: series.status || 'ongoing',
          cover_url: series.cover_url || null,
          ingest_status: series.ingest_status || 'published',
        },
        volumes: volumes.map((v: any) => ({
          volume_number: v.volume_number,
          title: v.title || null,
          description: v.description || null,
          publisher_slug: v.publisher_slug || v.publisher_name || (v.region_code === 'JP' ? 'shueisha' : 'viz_media'),
          region_code: v.region_code || 'US',
          edition_type: v.edition_type || 'single',
          language_code: v.language_code || (v.region_code || 'US').toLowerCase(),
          isbn: v.isbn || v.isbn13 || null,
          release_date: v.release_date || null,
          cover_url: v.cover_url || null,
          page_count: v.page_count || null,
          ingest_status: v.ingest_status || 'published',
          chapters: v.chapters || []
        }))
      }

      fs.writeFileSync(dataPath, JSON.stringify(v2Payload, null, 2), 'utf-8')
      migratedCount++
      console.log(`  ✅ Migrated "${dirName}"`)
    } catch (err: any) {
      console.error(`  ✗ Error migrating "${dirName}": ${err.message}`)
    }
  }

  console.log(`\n🎉 Data Migration complete! (${migratedCount} files updated)`)
}

migrate().catch(console.error)
