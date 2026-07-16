import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../../.env') })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function seedRegions() {
  const { error } = await supabase.from('regions').upsert([
    { code: 'US', name: '🇺🇸 United States' },
    { code: 'GB', name: '🇬🇧 United Kingdom' },
    { code: 'IN', name: '🇮🇳 India' },
    { code: 'AU', name: '🇦🇺 Australia' },
    { code: 'JP', name: '🇯🇵 Japan' },
    { code: 'DE', name: '🇩🇪 Germany' },
    { code: 'FR', name: '🇫🇷 France' }
  ])
  
  if (error) {
    console.error('Failed to seed regions:', error)
  } else {
    console.log('✅ Regions successfully seeded into the database!')
  }
}

seedRegions()
