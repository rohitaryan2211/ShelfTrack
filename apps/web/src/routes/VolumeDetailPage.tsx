import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookMarked, ShoppingBag, ExternalLink, List } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { Volume, Chapter, VolumeAvailability, LibraryEntry, ReadStatus } from '../lib/types'
import { READ_STATUS_LABELS } from '../lib/types'

const MOCK_VOLUME: Volume = {
  id: '1', series_id: '1', volume_number: 1, isbn13: '978-4-08-872509-8',
  cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg',
  release_date: '1997-12-24', publisher_id: '1', region_code: 'JP', page_count: 216,
  publisher: { id: '1', name: 'Shueisha', country: 'JP', is_original_publisher: true },
  series: { id: '1', title: 'One Piece', original_publisher_id: '1', type: 'manga', status: 'ongoing', created_at: '' },
}

const MOCK_CHAPTERS: Chapter[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i + 1), series_id: '1', chapter_number: i + 1,
  title: ['Romance Dawn', 'They Call Him Luffy', 'Morgan vs. Luffy', 'The Great Captain Usopp', 'Vs', 'The First Crew Member', "Swords, Knives, and Snots", 'Shounen Jump Special Edition'][i],
}))

const MOCK_AVAILABILITY: VolumeAvailability[] = [
  { id: '1', volume_id: '1', retailer_id: '1', region_code: 'US', product_url: 'https://www.viz.com/read/manga/one-piece/product/1', in_print: true, retailer: { id: '1', name: 'Viz Media', region_code: 'US' } },
  { id: '2', volume_id: '1', retailer_id: '2', region_code: 'US', product_url: 'https://www.amazon.com/dp/1591167817', in_print: true, retailer: { id: '2', name: 'Amazon US', region_code: 'US' } },
  { id: '3', volume_id: '1', retailer_id: '3', region_code: 'JP', product_url: 'https://www.amazon.co.jp/dp/4088725093', in_print: true, retailer: { id: '3', name: 'Amazon JP', region_code: 'JP' } },
]

const STATUS_OPTIONS: ReadStatus[] = ['plan_to_read', 'reading', 'completed', 'dropped', 'on_hold']

export default function VolumeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [volume, setVolume] = useState<Volume | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [availability, setAvailability] = useState<VolumeAvailability[]>([])
  const [libraryEntry, setLibraryEntry] = useState<Partial<LibraryEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [volResult, chapResult, availResult] = await Promise.all([
        supabase.from('volumes').select('*, publisher:publishers(*), series:series(id,title,type,status,original_publisher_id,created_at)').eq('id', id!).single(),
        supabase.from('volume_chapters').select('chapter:chapters(*)').eq('volume_id', id!).order('chapter_id'),
        supabase.from('volume_availability').select('*, retailer:retailers(*)').eq('volume_id', id!),
      ])
      setVolume(volResult.data ?? MOCK_VOLUME)
      const rawChapters = chapResult.data ?? []
      const mappedChapters = rawChapters.map((r: unknown) => (r as { chapter: Chapter }).chapter)
      setChapters(mappedChapters.length ? mappedChapters : MOCK_CHAPTERS)
      setAvailability(availResult.data?.length ? (availResult.data as VolumeAvailability[]) : MOCK_AVAILABILITY)
      setLoading(false)

      if (user) {
        const { data: entry } = await supabase.from('library_entries').select('*').eq('user_id', user.id).eq('volume_id', id!).single()
        setLibraryEntry(entry)
      }
    }
    if (id) load()
  }, [id, user])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const upsertEntry = async (updates: Partial<LibraryEntry>) => {
    if (!user) return
    setSavingStatus(true)
    const payload = { ...libraryEntry, ...updates, user_id: user.id, volume_id: id }
    const { data, error } = await supabase.from('library_entries').upsert(payload, { onConflict: 'user_id,volume_id' }).select().single()
    if (!error && data) { setLibraryEntry(data as LibraryEntry); showToast('Saved!') }
    setSavingStatus(false)
  }

  const vol = volume ?? MOCK_VOLUME

  return (
    <>
      <Link to={vol.series_id ? `/series/${vol.series_id}` : '/discover'} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-series-btn">
        <ArrowLeft size={16} /> {vol.series?.title ?? 'Back'}
      </Link>

      {/* ── Volume hero ──────────────────────────────── */}
      <div className="animate-fade-in" style={{ display: 'flex', gap: 'var(--space-8)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
        {/* Cover */}
        <div style={{ width: 180, flexShrink: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}>
          {vol.cover_url
            ? <img src={vol.cover_url} alt={`Vol. ${vol.volume_number}`} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            : <div className="cover-placeholder" style={{ height: 270 }}><BookMarked size={40} /></div>
          }
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 240 }}>
          {vol.series && (
            <Link to={`/series/${vol.series_id}`} className="badge badge-ink-green animate-fade-up" style={{ marginBottom: 'var(--space-3)', display: 'inline-flex', textDecoration: 'none' }}>
              {vol.series.title}
            </Link>
          )}
          <h1 className="animate-fade-up delay-100" style={{ marginBottom: 'var(--space-3)', fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
            Volume {vol.volume_number}{vol.title ? ` — ${vol.title}` : ''}
          </h1>

          {/* Metadata grid */}
          <div className="animate-fade-up delay-200" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {[
              { label: 'Publisher', value: vol.publisher?.name ?? '—' },
              { label: 'Release Date', value: vol.release_date ? new Date(vol.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—' },
              { label: 'ISBN-13', value: vol.isbn13 ?? '—' },
              { label: 'Pages', value: vol.page_count ? `${vol.page_count} pages` : '—' },
              { label: 'Region', value: vol.region_code },
              { label: 'Chapters', value: chapters.length > 0 ? `${chapters.length} chapters` : '—' },
            ].map(item => (
              <div key={item.label} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Action bar */}
          {user ? (
            <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <select
                id="volume-read-status-select"
                className="input select"
                style={{ width: 'auto', padding: '8px 36px 8px 12px' }}
                value={libraryEntry?.read_status ?? ''}
                disabled={savingStatus}
                onChange={e => upsertEntry({ read_status: e.target.value as ReadStatus })}
              >
                <option value="">📖 Add to list…</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{READ_STATUS_LABELS[s]}</option>)}
              </select>

              <button
                id="volume-owned-toggle-btn"
                className={`btn ${libraryEntry?.owned ? 'active-owned status-toggle' : 'status-toggle'}`}
                onClick={() => upsertEntry({ owned: !libraryEntry?.owned, read_status: libraryEntry?.read_status ?? 'plan_to_read' })}
                disabled={savingStatus}
                aria-pressed={!!libraryEntry?.owned}
              >
                <BookMarked size={15} />
                {libraryEntry?.owned ? '✓ On shelf' : 'Add to shelf'}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary animate-fade-up delay-300" id="volume-login-cta-btn">
              Sign in to track this volume →
            </Link>
          )}
        </div>
      </div>

      {/* ── Chapter list ─────────────────────────────── */}
      {chapters.length > 0 && (
        <section id="chapters-section" className="card animate-fade-up" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <List size={18} style={{ color: 'var(--ink-green)' }} />
            Chapters in this volume
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {chapters.map(ch => (
              <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', transition: 'background var(--dur-fast)' }} className="chapter-row" id={`chapter-row-${ch.id}`}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 40 }}>Ch. {ch.chapter_number}</span>
                <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', flex: 1 }}>{ch.title ?? `Chapter ${ch.chapter_number}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Where to buy ─────────────────────────────── */}
      <section id="volume-availability-section" className="animate-fade-up" style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={18} style={{ color: 'var(--vermillion)' }} /> Where to Buy
        </h2>
        {loading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : availability.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table" id="availability-table">
              <thead>
                <tr>
                  <th>Region</th><th>Retailer</th><th>Status</th><th>Link</th>
                </tr>
              </thead>
              <tbody>
                {availability.map(a => (
                  <tr key={a.id}>
                    <td>{a.region_code}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.retailer?.name}</td>
                    <td>
                      <span className={`badge ${a.in_print === true ? 'badge-slate' : a.in_print === false ? 'badge-neutral' : 'badge-ochre'}`}>
                        {a.in_print === true ? 'In Print' : a.in_print === false ? 'Out of Print' : 'Unknown'}
                      </span>
                    </td>
                    <td>
                      {a.product_url && (
                        <a href={a.product_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" id={`buy-vol-link-${a.id}`}>
                          <ExternalLink size={12} /> Buy
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><ShoppingBag size={28} /></div>
            <p>No retailer data yet for this volume.</p>
          </div>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className="toast" role="status">
          <span style={{ color: 'var(--slate)', fontSize: '1.25rem' }}>✓</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </>
  )
}
