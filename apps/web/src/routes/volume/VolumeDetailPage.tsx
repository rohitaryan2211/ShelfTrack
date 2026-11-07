import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, BookMarked, ShoppingBag, ExternalLink, List } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import type { Volume, Chapter, VolumeAvailability, LibraryEntry, CollectionStatus } from '../../lib/types'

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

  const [userChapterReads, setUserChapterReads] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const [volResult, chapResult, availResult] = await Promise.all([
        supabase.from('volumes').select('*, publisher:publishers(*), series:series(id,title,type,status,original_publisher_id,created_at)').eq('id', id!).single(),
        supabase.from('volume_chapters').select('chapter:chapters(*)').eq('volume_id', id!),
        supabase.from('volume_availability').select('*, retailer:retailers(*)').eq('volume_id', id!),
      ])
      setVolume(volResult.data as Volume | null)
      const rawChapters = (chapResult.data ?? []) as unknown as { chapter: Chapter | null }[]
      const mappedChapters = rawChapters
        .map(r => r.chapter)
        .filter((c): c is Chapter => !!c)
        .sort((a, b) => a.chapter_number - b.chapter_number)
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
            .select('chapter_id')
            .eq('user_id', user.id)
            .in('chapter_id', chapIds)

          if (reads) {
            setUserChapterReads(new Set(reads.map(r => r.chapter_id as string)))
          }
        }
      }
    }
    if (id) load()
  }, [id, user])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const toggleChapterRead = async (chapterId: string) => {
    if (!user) return
    const isRead = userChapterReads.has(chapterId)
    if (isRead) {
      const { error } = await supabase
        .from('user_chapter_reads')
        .delete()
        .eq('user_id', user.id)
        .eq('chapter_id', chapterId)

      if (!error) {
        const updated = new Set(userChapterReads)
        updated.delete(chapterId)
        setUserChapterReads(updated)
        showToast('Chapter marked unread')
      } else {
        showToast(`Error: ${error.message}`)
      }
    } else {
      const { error } = await supabase
        .from('user_chapter_reads')
        .insert({ user_id: user.id, chapter_id: chapterId })

      if (!error) {
        const updated = new Set(userChapterReads)
        updated.add(chapterId)
        setUserChapterReads(updated)
        showToast('Chapter marked read')
      } else {
        showToast(`Error: ${error.message}`)
      }
    }
  }

  // Volume entries only track collection (owned / wishlist); reading status lives on the series.
  // Toggling the active status off removes the entry entirely rather than leaving an empty row.
  const setCollectionStatus = async (next: CollectionStatus | null) => {
    if (!user) return
    setSavingStatus(true)

    if (next === null) {
      const { error } = await supabase
        .from('library_entries')
        .delete()
        .eq('user_id', user.id)
        .eq('volume_id', id!)
      if (error) {
        showToast(`Error: ${error.message}`)
      } else {
        setLibraryEntry(null)
        showToast('Removed')
      }
      setSavingStatus(false)
      return
    }

    const { data, error } = await supabase
      .from('library_entries')
      .upsert({
        user_id: user.id,
        volume_id: id,
        collection_status: next,
        // Keep the legacy column in sync — the volume_popularity view counts `owned`
        owned: next === 'owned',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,volume_id' })
      .select()
      .maybeSingle()

    if (error) {
      showToast(`Error: ${error.message}`)
    } else if (data) {
      setLibraryEntry(data as LibraryEntry)
      showToast(next === 'owned' ? 'Added to shelf' : 'Added to wishlist')
    }
    setSavingStatus(false)
  }

  const collectionStatus = libraryEntry?.collection_status ?? null

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
              <button
                id="volume-owned-toggle-btn"
                className={`btn status-toggle ${collectionStatus === 'owned' ? 'active-owned' : ''}`}
                onClick={() => setCollectionStatus(collectionStatus === 'owned' ? null : 'owned')}
                disabled={savingStatus}
                aria-pressed={collectionStatus === 'owned'}
              >
                <BookMarked size={15} />
                {collectionStatus === 'owned' ? '✓ On shelf' : 'Add to shelf'}
              </button>
              
              <button
                id="volume-wishlist-toggle-btn"
                className={`btn status-toggle ${collectionStatus === 'wishlist' ? 'active-wishlist' : ''}`}
                onClick={() => setCollectionStatus(collectionStatus === 'wishlist' ? null : 'wishlist')}
                disabled={savingStatus}
                aria-pressed={collectionStatus === 'wishlist'}
              >
                ★ {collectionStatus === 'wishlist' ? 'Wishlisted' : 'Add to wishlist'}
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
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {chapters.map(ch => {
              const isRead = userChapterReads.has(ch.id)
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
