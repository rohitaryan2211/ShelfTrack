import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function run() {
  console.log('=== REGIONS ===');
  const { data: regions } = await supabase.from('regions').select('*');
  console.log(JSON.stringify(regions, null, 2));

  console.log('\n=== PUBLISHERS ===');
  const { data: publishers } = await supabase.from('publishers').select('*');
  console.log(JSON.stringify(publishers, null, 2));

  console.log('\n=== SERIES ===');
  const { data: series } = await supabase.from('series').select('*');
  console.log(JSON.stringify(series, null, 2));

  console.log('\n=== VOLUMES (first 10) ===');
  const { data: volumes, count: volCount } = await supabase
    .from('volumes')
    .select('*', { count: 'exact' })
    .limit(10);
  console.log(`Total volumes: ${volCount}`);
  console.log(JSON.stringify(volumes, null, 2));

  console.log('\n=== CHAPTERS (first 10) ===');
  const { data: chapters, count: chapCount } = await supabase
    .from('chapters')
    .select('*', { count: 'exact' })
    .limit(10);
  console.log(`Total chapters: ${chapCount}`);
  console.log(JSON.stringify(chapters, null, 2));

  console.log('\n=== VOLUME_CHAPTERS (first 10) ===');
  const { data: vc, count: vcCount } = await supabase
    .from('volume_chapters')
    .select('*', { count: 'exact' })
    .limit(10);
  console.log(`Total volume_chapters: ${vcCount}`);
  console.log(JSON.stringify(vc, null, 2));

  // Check for duplicate chapters
  console.log('\n=== CHAPTER DUPLICATES CHECK ===');
  const { data: allChapters } = await supabase.from('chapters').select('series_id, chapter_number');
  if (allChapters) {
    const seen = new Map<string, number>();
    for (const ch of allChapters) {
      const key = `${ch.series_id}:${ch.chapter_number}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, count]) => count > 1);
    console.log(`Duplicate chapters: ${dupes.length}`);
    if (dupes.length > 0) {
      console.log('First 5 duplicates:', dupes.slice(0, 5));
    }
  }

  // Check volume distribution
  console.log('\n=== VOLUME DISTRIBUTION ===');
  const { data: allVolumes } = await supabase.from('volumes').select('volume_number, region_code');
  if (allVolumes) {
    const jpCount = allVolumes.filter(v => v.region_code === 'JP').length;
    const usCount = allVolumes.filter(v => v.region_code === 'US').length;
    const otherCount = allVolumes.filter(v => !['JP', 'US'].includes(v.region_code)).length;
    console.log(`JP volumes: ${jpCount}, US volumes: ${usCount}, Other: ${otherCount}`);
  }
}

run();
