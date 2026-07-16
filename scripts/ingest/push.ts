#!/usr/bin/env tsx
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import * as fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import { upsertSeries, upsertVolumes } from './upsert.ts'

const DRY_RUN = process.argv.includes('--dry-run')
const VETTED_DIR = resolve(__dirname, '../../.data/vetted')

async function main() {
  console.log(`\n🚀 ShelfTrack Push Script (Vet Flow)`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (pushing to DB)'}`)

  if (!fs.existsSync(VETTED_DIR)) {
    console.log(`No vetted data found at ${VETTED_DIR}`)
    return
  }

  const seriesDirs = fs.readdirSync(VETTED_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  if (seriesDirs.length === 0) {
    console.log(`No series directories found in ${VETTED_DIR}`)
    return
  }

  for (const dirName of seriesDirs) {
    console.log(`\n──────────────────────────────────────`)
    console.log(`📚 Pushing data for directory: ${dirName}`)
    
    const dataPath = join(VETTED_DIR, dirName, 'data.json')
    if (!fs.existsSync(dataPath)) {
      console.warn(`   ⚠ No data.json found in ${dirName}, skipping...`)
      continue
    }

    try {
      const payload = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
      const { series, volumes } = payload

      if (!series || !volumes) {
        console.warn(`   ⚠ Invalid data.json format in ${dirName}`)
        continue
      }

      // Upsert series
      const result = await upsertSeries(series, DRY_RUN)
      if (!result) {
        console.log(`   ✗ Failed to upsert series`)
        continue
      }

      const seriesId = result.id
      
      // Update volumes with the real seriesId
      for (const vol of volumes) {
        vol.series_id = seriesId
      }

      const volumesInserted = await upsertVolumes(volumes, DRY_RUN)
      console.log(`   ✓ ${volumesInserted}/${volumes.length} volumes inserted`)

      // Optionally, we could delete the directory after successful push, 
      // but keeping it until the user manually deletes is safer.
      console.log(`   💡 Tip: Delete the .data/vetted/${dirName} folder if you no longer need it.`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ✗ Error processing "${dirName}": ${msg}`)
    }
  }

  console.log(`\n✅ Push complete!`)
}

main().catch(console.error)
