#!/usr/bin/env tsx
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import * as fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { searchSeries as muSearchSeries, getSeriesById as muGetSeriesById } from './sources/mangaupdates.ts'
import { getMangaDexCovers } from './sources/mangadex.ts'
import { getVolumeISBN } from './sources/googlebooks.ts'
import { transformMUSeries, extractMUVolumes, buildVolumeInserts, seedPublisherCache, lookupPublisherId } from './transform.ts'
import { fetchPublishers } from './upsert.ts'

const DRY_RUN = process.argv.includes('--dry-run')
const INGEST_STATUS = 'draft'

// Pass titles via CLI args or use a default list for testing
let args = process.argv.slice(2).filter(a => !a.startsWith('--'))
if (args.length === 0) {
  args = ['One Piece'] // Default for testing
}

// Map of titles to their publishers for MU lookup if needed, though transform.ts might handle it.
// Assuming we can just look up "Shueisha" as a fallback or guess it. 
// For this script, we'll just require passing the publisher if we need to, but MU provides a publisher string often.
// Actually, seed.ts had a hardcoded list. Let's just use a hardcoded list if no args, or accept pairs.
// To keep it simple, we will just use a dummy publisher if we can't find it, or look it up.

const VETTED_DIR = resolve(__dirname, '../../.data/vetted')

async function downloadImage(url: string, destPath: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(destPath, buffer)
  } catch (err) {
    console.error(`   ✗ Failed to download image ${url}:`, err)
  }
}

async function main() {
  console.log(`\n📥 ShelfTrack Download Script (Vet Flow)`)
  
  if (!fs.existsSync(VETTED_DIR)) {
    fs.mkdirSync(VETTED_DIR, { recursive: true })
  }

  // 1. Load publisher ID cache
  const publishers = await fetchPublishers()
  seedPublisherCache(publishers)
  console.log(`✓ Loaded ${publishers.length} publishers from DB\n`)

  for (const title of args) {
    console.log(`\n──────────────────────────────────────`)
    console.log(`📚 Downloading data for: ${title}`)
    
    // We need a publisher for the seed.ts logic. Let's just default to a known one if we don't have it.
    // In real usage, the user would provide it. For now, Shueisha is a safe fallback for manga.
    const publisherId = lookupPublisherId('Shueisha') 

    try {
      const muResults = await muSearchSeries(title, 1, 1)
      const muHit = muResults[0]
      if (!muHit) {
        console.warn(`   ⚠ Not found on MangaUpdates: ${title}`)
        continue
      }

      const muSeries = await muGetSeriesById(muHit.record.series_id)
      if (!muSeries) {
        console.warn(`   ⚠ Failed to fetch MU series details: ${title}`)
        continue
      }

      console.log(`   MangaUpdates: "${muSeries.title}" (id: ${muSeries.series_id})`)
      const seriesInsert = transformMUSeries(muSeries, publisherId, INGEST_STATUS)
      const totalVolumes = extractMUVolumes(muSeries.status)
      const coverImage = muSeries.image?.url?.original ?? null

      // Create folder for series
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const seriesDir = join(VETTED_DIR, safeTitle)
      if (!fs.existsSync(seriesDir)) {
        fs.mkdirSync(seriesDir, { recursive: true })
      }

      console.log(`   Fetching MangaDex covers for ${totalVolumes} volumes…`)
      const mangadexCovers = await getMangaDexCovers(title)

      const volumes = buildVolumeInserts(
        '00000000-0000-0000-0000-000000000000', // Dummy series ID for now, will be set on push
        publisherId, 
        totalVolumes, 
        coverImage, 
        INGEST_STATUS, 
        mangadexCovers
      )

      // Optionally fetch ISBNs for first few
      if (process.env.GOOGLE_BOOKS_API_KEY) {
        for (const vol of volumes.slice(0, 3)) {
          const isbn = await getVolumeISBN(title, vol.volume_number)
          if (isbn) vol.isbn13 = isbn
          await new Promise(r => setTimeout(r, 300))
        }
      }

      const dataPayload = {
        series: seriesInsert,
        volumes: volumes
      }

      fs.writeFileSync(join(seriesDir, 'data.json'), JSON.stringify(dataPayload, null, 2))
      console.log(`   ✓ Saved data.json to ${seriesDir}`)

      // Download covers for vetting
      if (coverImage) {
        console.log(`   Downloading series cover...`)
        await downloadImage(coverImage, join(seriesDir, 'series_cover.jpg'))
      }

      console.log(`   Downloading volume covers...`)
      for (const vol of volumes) {
        if (vol.cover_url && vol.cover_url !== coverImage) {
          await downloadImage(vol.cover_url, join(seriesDir, `volume_${vol.volume_number}_cover.jpg`))
        }
      }
      
      console.log(`   ✓ Finished downloading vetting data for ${title}`)

      await new Promise(r => setTimeout(r, 1000))

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ✗ Error processing "${title}": ${msg}`)
    }
  }
}

main().catch(console.error)
