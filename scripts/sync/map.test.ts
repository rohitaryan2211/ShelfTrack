import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapStatus, mapGenre, cleanDescription, pickAuthor, resolveChapterVolumes,
  chapterNumbers, pickEnglishLicensor, pickOriginalPublisher, slugify, canonicalPublisherName,
} from './map.ts'

test('mapStatus', () => {
  assert.equal(mapStatus('FINISHED'), 'completed')
  assert.equal(mapStatus('CANCELLED'), 'completed')
  assert.equal(mapStatus('HIATUS'), 'hiatus')
  assert.equal(mapStatus('RELEASING'), 'ongoing')
  assert.equal(mapStatus(null), 'ongoing')
})

test('mapGenre prefers demographic, then AniList genre priority', () => {
  assert.equal(mapGenre('shounen', ['Romance']), 'shonen')
  assert.equal(mapGenre('shoujo', []), 'shojo')
  assert.equal(mapGenre(null, ['Action', 'Romance']), 'romance')
  assert.equal(mapGenre(null, ['Action', 'Comedy']), 'action')
  assert.equal(mapGenre(null, ['Sports']), 'other')
})

test('cleanDescription strips html, source credits and notes', () => {
  const raw = 'Denji is poor.<br>\n<br>\n(Source: MANGA Plus)<br>\n<br>\n<i>Notes:<br>\n- Won an award.</i>'
  assert.equal(cleanDescription(raw), 'Denji is poor.')
  assert.equal(cleanDescription('A &amp; B &quot;C&quot;'), 'A & B "C"')
  assert.equal(cleanDescription(null), null)
  assert.equal(cleanDescription('<br>'), null)
})

test('pickAuthor orders Story & Art, Story, Art and ignores assistants', () => {
  const staff = (pairs: [string, string][]) => ({
    staff: { edges: pairs.map(([role, name]) => ({ role, node: { name: { full: name } } })) },
  })
  assert.equal(pickAuthor(staff([['Assistant', 'X'], ['Story & Art', 'Tatsuki Fujimoto']])), 'Tatsuki Fujimoto')
  assert.equal(pickAuthor(staff([['Art', 'Takeshi Obata'], ['Story', 'Tsugumi Ohba']])), 'Tsugumi Ohba, Takeshi Obata')
  assert.equal(pickAuthor(staff([['Story (Original)', 'A'], ['Lettering (English)', 'B']])), 'A')
  assert.equal(pickAuthor(staff([])), null)
})

test('resolveChapterVolumes drops out-of-order outliers', () => {
  const votes = [
    { chapter: 1, volume: 1, count: 3 },
    { chapter: 2, volume: 1, count: 3 },
    { chapter: 8, volume: 2, count: 3 },
    { chapter: 9, volume: 2, count: 3 },
    { chapter: 232, volume: 1, count: 1 },   // mis-tagged upload
    { chapter: 230, volume: 24, count: 2 },
    { chapter: 231, volume: null, count: 5 },
  ]
  const map = resolveChapterVolumes(votes)
  assert.equal(map.get(1), 1)
  assert.equal(map.get(9), 2)
  assert.equal(map.get(230), 24)
  assert.equal(map.has(232), false)
  assert.equal(map.has(231), false)
})

test('resolveChapterVolumes takes the majority vote per chapter', () => {
  const map = resolveChapterVolumes([
    { chapter: 5, volume: 1, count: 1 },
    { chapter: 5, volume: 2, count: 4 },
    { chapter: 6, volume: 2, count: 1 },
  ])
  assert.equal(map.get(5), 2)
  assert.equal(map.get(6), 2)
})

test('chapterNumbers fills 1..max and keeps known decimals', () => {
  assert.deepEqual(chapterNumbers(3, [2.5, 3]), [1, 2, 2.5, 3])
  assert.deepEqual(chapterNumbers(null, [1, 2]), [1, 2])
  assert.equal(chapterNumbers(10_000, [], 100).length, 100)
})

test('pickEnglishLicensor parses volume counts and skips omnibus/digital', () => {
  const pubs = [
    { publisher_name: 'MANGA Plus', publisher_id: 1, type: 'English', notes: '' },
    { publisher_name: 'Shueisha', publisher_id: 2, type: 'Original', notes: null },
    { publisher_name: 'VIZ Media', publisher_id: 3, type: 'English', notes: '21 Volumes; Ongoing' },
    { publisher_name: 'VIZ Omnibus', publisher_id: 4, type: 'English', notes: '10 3-in-1 Volumes' },
  ]
  assert.deepEqual(pickEnglishLicensor(pubs), { name: 'Viz Media', volumes: 21 })
  assert.equal(pickOriginalPublisher(pubs), 'Shueisha')
  assert.equal(pickEnglishLicensor([]), null)
  assert.deepEqual(
    pickEnglishLicensor([{ publisher_name: 'VIZ Media', publisher_id: 5, type: 'English', notes: '111 Volumes; Ongoing | 35 3-in-1 Omnibuses; Ongoing' }]),
    { name: 'Viz Media', volumes: 111 },
  )
  assert.equal(
    pickEnglishLicensor([{ publisher_name: 'MANGA Plus', publisher_id: 6, type: 'English', notes: '1186 Chapters; Ongoing' }]),
    null,
  )
})

test('slugify', () => {
  assert.equal(slugify('VIZ Media'), 'viz_media')
  assert.equal(slugify('Kodansha USA'), 'kodansha_usa')
  assert.equal(slugify('  Square-Enix!! '), 'square_enix')
})

test('canonicalPublisherName folds imprints and short forms', () => {
  assert.equal(canonicalPublisherName('Viz'), 'Viz Media')
  assert.equal(canonicalPublisherName('VIZ Media'), 'Viz Media')
  assert.equal(canonicalPublisherName('Shonen Sunday'), 'Viz Media')
  assert.equal(canonicalPublisherName('Kodansha Comics'), 'Kodansha USA')
  assert.equal(canonicalPublisherName('Daum'), 'Daum')
})
