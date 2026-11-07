#!/usr/bin/env tsx
/**
 * Enhanced push script with comprehensive validation, error handling, and logging.
 * 
 * Usage:
 *   pnpm push:v2                              # Standard ingestion
 *   pnpm push:v2 --dry-run                    # Preview changes
 *   pnpm push:v2 --validate-only              # Validate without ingesting
 *   pnpm push:v2 --series=jujutsu_kaisen      # Single series
 *   pnpm push:v2 --verbose                    # Detailed logging
 *   pnpm push:v2 --strict                     # Exit non-zero on first failure
 *   pnpm push:v2 --report-path=./report.json  # Save report
 * 
 * Improvements over legacy push.ts:
 * - Comprehensive field validation with detailed error messages
 * - Structured JSON logging and audit trail
 * - Batch statistics and progress tracking
 * - Error recovery and partial failure handling
 * - Performance metrics and reporting
 */

import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import * as fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

import {
  upsertSeries,
  upsertVolumes,
  printStats,
  getLogs,
  getStats,
  validateSeriesData,
  validateVolumeData,
  log,
} from './upsert-enhanced.ts'
import { SeriesCatalogSchema } from '../../packages/shared/src/schemas/catalog.ts'

// ─── ARGUMENT PARSING ─────────────────────────────────────────────────────

interface PushOptions {
  dryRun: boolean
  validateOnly: boolean
  verbose: boolean
  strict: boolean
  seriesFilter: string | null
  reportPath: string | null
}

function parseArgs(): PushOptions {
  return {
    dryRun: process.argv.includes('--dry-run'),
    validateOnly: process.argv.includes('--validate-only'),
    verbose: process.argv.includes('--verbose'),
    strict: process.argv.includes('--strict'),
    seriesFilter: process.argv
      .find(arg => arg.startsWith('--series='))
      ?.split('=')[1] || null,
    reportPath: process.argv
      .find(arg => arg.startsWith('--report-path='))
      ?.split('=')[1] || null,
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs()
  const VETTED_DIR = resolve(__dirname, '../../data/vetted')

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ShelfTrack Data Ingestion (Enhanced Pipeline v2.1)`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`\n  Mode:           ${options.dryRun ? 'DRY RUN' : options.validateOnly ? 'VALIDATE ONLY' : 'LIVE'}`)
  console.log(`  Verbose:        ${options.verbose ? 'YES' : 'NO'}`)
  console.log(`  Strict Mode:    ${options.strict ? 'YES' : 'NO'}`)
  if (options.seriesFilter) console.log(`  Filter:         ${options.seriesFilter}`)
  console.log(`\n${'─'.repeat(60)}\n`)

  // Step 1: Discover series directories
  if (!fs.existsSync(VETTED_DIR)) {
    console.error(`\n✗ Vetted data directory not found: ${VETTED_DIR}`)
    process.exit(1)
  }

  const seriesDirs = fs
    .readdirSync(VETTED_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !options.seriesFilter || name === options.seriesFilter)

  if (seriesDirs.length === 0) {
    console.error(`\n✗ No series directories found in ${VETTED_DIR}`)
    if (options.seriesFilter) {
      console.error(`  (Searched for: ${options.seriesFilter})`)
    }
    process.exit(1)
  }

  console.log(`📂 Found ${seriesDirs.length} series to process\n`)

  // Step 2: Process each series
  let totalErrors = 0
  const processedSeries: Array<{ name: string; success: boolean; errors: number }> = []

  for (const dirName of seriesDirs) {
    const dataPath = join(VETTED_DIR, dirName, 'data.json')

    if (!fs.existsSync(dataPath)) {
      log('WARN', 'main', `No data.json found in "${dirName}"`, { path: dataPath })
      processedSeries.push({ name: dirName, success: false, errors: 1 })
      totalErrors++
      continue
    }

    console.log(`\n📚 Processing: ${dirName}`)
    console.log(`   Path: ${dataPath}`)

    try {
      // Parse JSON
      const rawPayload = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

      // Validate against schema
      const parseResult = SeriesCatalogSchema.safeParse(rawPayload)
      if (!parseResult.success) {
        const errorDetails = parseResult.error.format()
        log('ERROR', `series:${dirName}`, `Schema validation failed`, { errors: errorDetails })
        console.error(`   ✗ Schema Validation Failed`)
        console.error(`   Details: ${JSON.stringify(errorDetails, null, 2).substring(0, 300)}...`)

        if (options.strict) {
          console.error(`\n   Strict mode enabled. Exiting.`)
          process.exit(1)
        }

        processedSeries.push({ name: dirName, success: false, errors: 1 })
        totalErrors++
        continue
      }

      const { series, volumes } = parseResult.data

      // Validate series data
      const seriesErrors = validateSeriesData(series)
      if (seriesErrors.length > 0) {
        log('ERROR', `series:${dirName}`, `Series validation failed`, { errors: seriesErrors })
        console.error(`   ✗ Series Validation Errors:`)
        seriesErrors.forEach((err, i) => {
          console.error(`     ${i + 1}. ${err.field}: ${err.suggestion}`)
        })

        if (options.strict) {
          console.error(`\n   Strict mode enabled. Exiting.`)
          process.exit(1)
        }

        processedSeries.push({ name: dirName, success: false, errors: seriesErrors.length })
        totalErrors += seriesErrors.length
        continue
      }

      // Validate volumes data
      let volumeErrorCount = 0
      for (let i = 0; i < volumes.length; i++) {
        const volErrors = validateVolumeData(volumes[i])
        if (volErrors.length > 0) {
          log('WARN', `series:${dirName}`, `Volume ${i + 1} validation issues`, { errors: volErrors })
          console.warn(`   ⚠ Volume ${volumes[i].volume_number} has issues:`)
          volErrors.forEach(err => {
            console.warn(`     - ${err.field}: ${err.suggestion}`)
          })
          volumeErrorCount += volErrors.length
        }
      }

      if (volumeErrorCount > 0 && options.strict) {
        console.error(`   Strict mode enabled. Exiting.`)
        process.exit(1)
      }

      // Validate only mode
      if (options.validateOnly) {
        console.log(`   ✓ Validation passed (no data written)`)
        processedSeries.push({ name: dirName, success: true, errors: 0 })
        continue
      }

      // Upsert series
      console.log(`   ➜ Upserting series...`)
      const seriesResult = await upsertSeries(series, options.dryRun)

      if (!seriesResult) {
        console.error(`   ✗ Failed to upsert series`)
        if (options.strict) {
          console.error(`   Strict mode enabled. Exiting.`)
          process.exit(1)
        }
        processedSeries.push({ name: dirName, success: false, errors: 1 })
        totalErrors++
        continue
      }

      const seriesId = seriesResult.id
      console.log(`   ✓ Series: ${seriesResult.inserted ? 'INSERTED' : 'UPDATED'} (${seriesId}) [${seriesResult.duration_ms}ms]`)

      // Prepare and upsert volumes
      console.log(`   ➜ Upserting ${volumes.length} volumes...`)
      const preparedVolumes = volumes.map(v => ({
        ...v,
        series_id: seriesId,
      }))

      const volumesInserted = await upsertVolumes(preparedVolumes, options.dryRun)
      console.log(`   ✓ Volumes: ${volumesInserted}/${volumes.length} processed`)

      processedSeries.push({ name: dirName, success: true, errors: 0 })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log('ERROR', `series:${dirName}`, `Unexpected error`, { error: msg })
      console.error(`   ✗ Error: ${msg}`)

      if (options.strict) {
        console.error(`\n   Strict mode enabled. Exiting.`)
        process.exit(1)
      }

      processedSeries.push({ name: dirName, success: false, errors: 1 })
      totalErrors++
    }
  }

  // Step 3: Summary and reporting
  printStats()

  console.log(`\n📋 Series Summary:`)
  const successCount = processedSeries.filter(s => s.success).length
  console.log(`   Successful: ${successCount}/${processedSeries.length}`)
  console.log(`   Failed:     ${processedSeries.length - successCount}/${processedSeries.length}`)

  if (options.verbose) {
    console.log(`\n   Details:`)
    processedSeries.forEach(ps => {
      const status = ps.success ? '✓' : '✗'
      const errorStr = ps.errors > 0 ? ` (${ps.errors} error${ps.errors > 1 ? 's' : ''})` : ''
      console.log(`     ${status} ${ps.name}${errorStr}`)
    })
  }

  // Step 4: Generate report
  if (options.reportPath) {
    const stats = getStats()
    const report = {
      timestamp: new Date().toISOString(),
      batch_id: stats.batchId,
      mode: options.dryRun ? 'dry_run' : 'live',
      duration_seconds: (stats.endTime!.getTime() - stats.startTime.getTime()) / 1000,
      stats,
      series_results: processedSeries,
      logs: options.verbose ? getLogs() : [],
    }

    fs.writeFileSync(options.reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Report saved: ${options.reportPath}`)
  }

  // Exit with error code if there were failures
  if (totalErrors > 0) {
    console.log(`\n⚠ Completed with ${totalErrors} error${totalErrors > 1 ? 's' : ''}`)
    process.exit(options.strict ? 1 : 0)
  } else {
    console.log(`\n✅ Ingestion complete!`)
    process.exit(0)
  }
}

main().catch(err => {
  console.error(`\n✗ Fatal error:`, err instanceof Error ? err.message : String(err))
  process.exit(1)
})
