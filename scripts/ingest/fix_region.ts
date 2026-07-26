import * as fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '../../data/vetted/jujutsu_kaisen/data.json');
const payload = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

for (const vol of payload.volumes) {
  if (vol.region_code === 'EN') {
    vol.region_code = 'US';
  }
}

fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2));
console.log('Fixed region_code from EN to US in data.json');
