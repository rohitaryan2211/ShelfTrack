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

const STANDARD_PUBLISHERS = [
  { name: 'Shueisha', country: 'JP', website: 'https://www.shueisha.co.jp', is_original_publisher: true },
  { name: 'Kodansha', country: 'JP', website: 'https://www.kodansha.co.jp', is_original_publisher: true },
  { name: 'Shogakukan', country: 'JP', website: 'https://www.shogakukan.co.jp', is_original_publisher: true },
  { name: 'Square Enix', country: 'JP', website: 'https://www.square-enix.co.jp', is_original_publisher: true },
  { name: 'Viz Media', country: 'US', website: 'https://www.viz.com', is_original_publisher: false },
  { name: 'Yen Press', country: 'US', website: 'https://yenpress.com', is_original_publisher: false },
  { name: 'Seven Seas', country: 'US', website: 'https://sevenseasentertainment.com', is_original_publisher: false },
  { name: 'Kodansha USA', country: 'US', website: 'https://kodanshausa.com', is_original_publisher: false }
]

async function seedPublishers() {
  console.log('Seeding standard publishers...')
  
  // Clean duplicates by upserting on name
  // Note: Since 'name' is not a unique constraint, we check existence or upsert.
  // To avoid duplicates we will query and insert.
  let inserted = 0
  for (const pub of STANDARD_PUBLISHERS) {
    const { data: existing } = await supabase
      .from('publishers')
      .select('id')
      .ilike('name', pub.name)
      .single()
      
    if (existing) {
      console.log(`[skip] Publisher already exists: ${pub.name}`)
      continue
    }
    
    const { error } = await supabase.from('publishers').insert(pub)
    if (error) {
      console.error(`Failed to insert publisher ${pub.name}:`, error.message)
    } else {
      console.log(`[+] Seeded publisher: ${pub.name}`)
      inserted++
    }
  }
  
  console.log(`✅ Seed publishers complete! Seeded ${inserted} publishers.`)
}

seedPublishers().catch(console.error)
