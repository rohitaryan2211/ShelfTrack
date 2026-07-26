#!/usr/bin/env tsx
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse target table argument e.g. --table series
const tableArgIdx = process.argv.indexOf('--table')
const targetTable = tableArgIdx !== -1 ? process.argv[tableArgIdx + 1] : null

async function clearDb() {
  const table = targetTable?.toLowerCase()

  if (table && !['series', 'volumes', 'publishers', 'regions'].includes(table)) {
    console.error(`Error: Invalid table target "${targetTable}". Supported tables: series, volumes, publishers, regions`)
    process.exit(1)
  }

  if (table) {
    console.log(`⚠️ WARNING: This will delete ALL data from the target table "${table}" (and any dependent cascading records).`)
  } else {
    console.log('⚠️ WARNING: This will delete ALL data from ALL tables (series, volumes, publishers, regions, etc.).')
  }

  // Wait 3 seconds to allow user to cancel
  console.log('Starting in 3 seconds. Press Ctrl+C to abort...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Delete matching tables
  if (!table || table === 'series') {
    console.log('Deleting from series table...')
    const { count, error } = await supabase
      .from('series')
      .delete({ count: 'exact' })
      .not('id', 'is', null)
      
    if (error) {
      console.error('Error deleting from series:', error.message)
    } else {
      console.log(`- Series deleted: ${count}`)
    }
  }

  if (table === 'volumes') {
    console.log('Deleting from volumes table...')
    const { count, error } = await supabase
      .from('volumes')
      .delete({ count: 'exact' })
      .not('id', 'is', null)

    if (error) {
      console.error('Error deleting from volumes:', error.message)
    } else {
      console.log(`- Volumes deleted: ${count}`)
    }
  }

  if (!table || table === 'publishers') {
    console.log('Deleting from publishers table...')
    const { count, error } = await supabase
      .from('publishers')
      .delete({ count: 'exact' })
      .not('id', 'is', null)
      
    if (error) {
      console.error('Error deleting from publishers (Note: Foreign key constraints on series or volumes might prevent this if they are not cleared first):', error.message)
    } else {
      console.log(`- Publishers deleted: ${count}`)
    }
  }

  if (!table || table === 'regions') {
    console.log('Deleting from regions table...')
    const { count, error } = await supabase
      .from('regions')
      .delete({ count: 'exact' })
      .not('code', 'is', null)
      
    if (error) {
      console.error('Error deleting from regions (Note: Foreign key constraints on publishers, series, or volumes might prevent this):', error.message)
    } else {
      console.log(`- Regions deleted: ${count}`)
    }
  }

  console.log('✅ Clearing task complete.')
}

clearDb().catch(err => {
  console.error("An error occurred:", err)
  process.exit(1)
})
