import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookMarked, ShoppingBag, ExternalLink, List } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import type { Volume, Chapter, VolumeAvailability, LibraryEntry, ReadStatus, ReadFormat } from '../../lib/types'
import { READ_STATUS_LABELS } from '../../lib/types'

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

  const [userChapterReads, setUserChapterReads] = useState<Record<string, ReadFormat>>({})
  const [selectedFormat, setSelectedFormat] = useState<ReadFormat>('digital')

  useEffect(() => {
    async function load() {
      const [volResult, chapResult, availResult] = await Promise.all([
        supabase.from('volumes').select('*, publisher:publishers(*), series:series(id,title,type,status,original_publisher_id,created_at)').eq('id', id!).single(),
        supabase.from('volume_chapters').select('chapter:chapters(*)').eq('volume_id', id!).order('chapter_id'),
        supabase.from('volume_availability').select('*, retailer:retailers(*)').eq('volume_id', id!),
      ])
      setVolume(volResult.data as Volume | null)
      const rawChapters = chapResult.data ?? []
      const mappedChapters = rawChapters.map((r: any) => (r as { chapter: Chapter }).chapter)
      setChapters(mappedChapters)
      setAvailability((availResult.data as VolumeAvailability[]) ?? [])
      setLoading(false)

      if (user) {
        const { data: entry } = await supabase.from('library_entries').select('*').eq('user_id', user.id).eq('volume_id', id!).maybeSingle()
        setLibraryEntry(entry)

        if (mappedChapters.length > 0) {
          const chapIds = mappedChapters.map(c => c.id)
          const { data: reads } = await supabase
            .from('user_chapter_reads')
            .select('chapter_id, read_format')
            .eq('user_id', user.id)
            .in('chapter_id', chapIds)

          if (reads) {
            const map: Record<string, ReadFormat> = {}
            reads.forEach((r: any) => { map[r.chapter_id] = r.read_format })
            setUserChapterReads(map)
          }
        }
      }
    }
    if (id) load()
  }, [id, user])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const toggleChapterRead = async (chapterId: string) => {
    if (!user) return
    const isRead = !!userChapterReads[chapterId]
    if (isRead) {
      const { error } = await supabase
        .from('user_chapter_reads')
        .delete()
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)

      if (!error) {
        const updated = { ...userChapterReads }
        delete updated[chapterId]
        setUserChapterReads(updated)
        showToast('Chapter unread')
      } else {
        showToast(`Error: ${error.message}`)
      }
    } else {
      const check = await supabase.from('user_chapter_reads').select('id').eq('user_id', user.id).eq('chapter_id', chapterId).maybeSingle()
      let error = null
      if (check.data?.id) {
        const res = await supabase.from('user_chapter_reads').update({ read_format: selectedFormat }).eq('id', check.data.id)
        error = res.error
      } else {
        const res = await supabase.from('user_chapter_reads').insert({ user_id: user.id, chapter_id: chapterId, read_format: selectedFormat })
        error = res.error
      }

      if (!error) {
        setUserChapterReads(prev => ({ ...prev, [chapterId]: selectedFormat }))
        showToast(`Marked read (${selectedFormat})`)
      } else {
        showToast(`Error: ${error.message}`)
      }
    }
  }

  const upsertEntry = async (updates: Partial<LibraryEntry>) => {
    if (!user) return
    setSavingStatus(true)
    let error = null
    let updatedEntry = null

    const existingId = libraryEntry?.id
    if (existingId) {
      const res = await supabase.from('library_entries').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existingId).select().maybeSingle()
      error = res.error
      updatedEntry = res.data
    } else {
      const check = await supabase.from('library_entries').select('id').eq('user_id', user.id).eq('volume_id', id!).maybeSingle()
      if (check.data?.id) {
        const res = await supabase.from('library_entries').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', check.data.id).select().maybeSingle()
        error = res.error
        updatedEntry = res.data
      } else {
        const res = await supabase.from('library_entries').insert({ ...updates, user_id: user.id, volume_id: id }).select().maybeSingle()
        error = res.error
        updatedEntry = res.data
      }
    }

    if (!error && updatedEntry) {
      setLibraryEntry(updatedEntry as LibraryEntry)
      showToast('Saved!')
    } else if (error) {
      showToast(`Error: ${error.message}`)
    }
    setSavingStatus(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="skeleton" style={{ height: 40, width: 200 }} />
        <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
          <div className="skeleton" style={{ width: 180, height: 270, borderRadius: 'var(--radius-lg)' }} />
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="skeleton" style={{ height: 20, width: 100 }} />
            <div className="skeleton" style={{ height: 36, width: '60%' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
      </div>
    )
  }

  if (!volume) {
    return (
      <>
        <Link to="/discover" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Discover
        </Link>
        <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
          <div className="empty-state-icon"><BookMarked size={28} /></div>
          <h3>Volume not found</h3>
          <p>The requested volume does not exist or has not been published in the catalog.</p>
        </div>
      </>
    )
  }

  const vol = volume

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

          {vol.description && (
            <p className="animate-fade-up delay-150" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              {vol.description}
            </p>
          )}

          {/* Metadata grid */}
          <div className="animate-fade-up delay-200" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {[
              { label: 'Publisher', value: vol.publisher?.name ?? '—' },
              { label: 'Release Date', value: vol.release_date ? new Date(vol.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—' },
              { label: 'Edition', value: vol.edition_type ? vol.edition_type.toUpperCase() : 'SINGLE' },
              { label: 'Language', value: vol.language_code ? vol.language_code.toUpperCase() : vol.region_code },
              { label: 'ISBN', value: vol.isbn ?? vol.isbn13 ?? '—' },
              { label: 'Pages', value: vol.page_count ? `${vol.page_count} pages` : '—' },
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

      {/* ── Chapter list with format selector ─────────────────────────────── */}
      {chapters.length > 0 && (
        <section id="chapters-section" className="card animate-fade-up" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <List size={18} style={{ color: 'var(--ink-green)' }} />
              Chapters in this volume
            </h2>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Read format:</span>
                {(['digital', 'physical', 'scanlation'] as ReadFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    className={`btn btn-sm ${selectedFormat === fmt ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedFormat(fmt)}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {chapters.map(ch => {
              const readFormat = userChapterReads[ch.id]
              const isRead = !!readFormat
              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: isRead ? 'rgba(62, 92, 62, 0.15)' : 'transparent', transition: 'background var(--dur-fast)' }} className="chapter-row" id={`chapter-row-${ch.id}`}>
                  {user && (
                    <input
                      type="checkbox"
                      checked={isRead}
                      onChange={() => toggleChapterRead(ch.id)}
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--ink-green)' }}
                    />
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 40 }}>Ch. {ch.chapter_number}</span>
                  <span style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', flex: 1 }}>{ch.title ?? `Chapter ${ch.chapter_number}`}</span>
                  {readFormat && (
                    <span className="badge badge-ink-green" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                      {readFormat}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Where to buy ─────────────────────────────── */}
      <section id="volume-availability-section" className="animate-fade-up" style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingBag size={18} style={{ color: 'var(--vermillion)' }} /> Where to Buy
        </h2>
        {availability.length > 0 ? (
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
