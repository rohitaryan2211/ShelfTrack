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

async function clearDb() {
  console.log('⚠️ WARNING: This will delete ALL data from ALL tables (series, volumes, publishers, regions, etc.).')
  
  // Wait 3 seconds to allow user to cancel
  console.log('Starting in 3 seconds. Press Ctrl+C to abort...')
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  console.log('Deleting from series table...')
  
  // Delete all tables in reverse dependency order or use CASCADE if we could execute SQL,
  // but using Supabase client we just delete from them individually.
  // Actually, 'series' cascades to volumes and library entries.
  const { count: seriesCount, error: seriesErr } = await supabase
    .from('series')
    .delete({ count: 'exact' })
    .not('id', 'is', null)

  if (seriesErr) console.error('Error deleting from series:', seriesErr.message)

  console.log('Deleting from publishers table...')
  const { count: pubCount, error: pubErr } = await supabase
    .from('publishers')
    .delete({ count: 'exact' })
    .not('id', 'is', null)
    
  if (pubErr) console.error('Error deleting from publishers:', pubErr.message)

  console.log('Deleting from regions table...')
  const { count: regCount, error: regErr } = await supabase
    .from('regions')
    .delete({ count: 'exact' })
    .not('code', 'is', null)
    
  if (regErr) console.error('Error deleting from regions:', regErr.message)

  console.log(`✅ Successfully deleted data.`)
  console.log(`- Series deleted: ${seriesCount}`)
  console.log(`- Publishers deleted: ${pubCount}`)
  console.log(`- Regions deleted: ${regCount}`)
  console.log('All data should now be cleared.')
}

clearDb().catch(err => {
  console.error("An error occurred:", err)
  process.exit(1)
})
