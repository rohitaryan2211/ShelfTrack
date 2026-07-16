import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, BookMarked, Eye, Star, ShoppingBag,
  ChevronDown, ChevronUp, ExternalLink, BookOpen
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { Series, Volume, Review, LibraryEntry, ReadStatus, VolumeAvailability } from '../lib/types'
import { READ_STATUS_LABELS } from '../lib/types'
import { SkeletonCard } from '../components/Cards'

const MOCK_SERIES: Series = {
  id: '1', title: 'One Piece', original_title: 'ワンピース', type: 'manga', status: 'ongoing',
  cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg',
  description: 'Gol D. Roger was known as the "Pirate King," the strongest and most infamous being to have sailed the Grand Line. The capture and execution of Roger by the World Government brought a change throughout the world. His last words before his death revealed the existence of the greatest treasure in the world, One Piece. It was this revelation that brought about the Grand Age of Pirates, men who dreamed of finding One Piece—which promises an unlimited amount of riches and fame—and quite possibly the pinnacle of glory and the title of the Pirate King.',
  original_publisher_id: '1', created_at: '2020-01-01', avg_rating: 9.2,
  _count: { volumes: 108, readers: 12400, owned: 8900 },
  publisher: { id: '1', name: 'Shueisha', country: 'JP', is_original_publisher: true },
}

const MOCK_VOLUMES: Volume[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1), series_id: '1', volume_number: i + 1,
  cover_url: `https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg`,
  release_date: `${2000 + i}-06-01`, publisher_id: '1', region_code: 'JP', isbn13: `978-4-08-87${String(i + 1).padStart(4, '0')}-0`,
}))

const MOCK_REVIEWS: Review[] = [
  { id: '1', user_id: 'u1', series_id: '1', body: "One Piece is the greatest manga ever written. The world-building, the characters, the themes of freedom and found family — nothing else comes close. Oda's dedication to foreshadowing stretching 20+ years is unmatched.", rating: 10, contains_spoilers: false, created_at: '2024-06-01', profile: { id: 'u1', username: 'nakama_forever', created_at: '' } },
  { id: '2', user_id: 'u2', series_id: '1', body: "Slow to start but once it clicks, it REALLY clicks. The Marineford arc had me crying. I've now bought all 108 volumes twice — once for reading, once for display.", rating: 9, contains_spoilers: true, created_at: '2024-04-15', profile: { id: 'u2', username: 'shelf_collector', created_at: '' } },
]

const STATUS_OPTIONS: ReadStatus[] = ['plan_to_read', 'reading', 'completed', 'dropped', 'on_hold']

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [series, setSeries] = useState<Series | null>(null)
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [availability, setAvailability] = useState<VolumeAvailability[]>([])
  const [libraryEntry, setLibraryEntry] = useState<Partial<LibraryEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [whereToByOpen, setWhereToBuyOpen] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [seriesResult, volumesResult, reviewsResult] = await Promise.all([
        supabase.from('series').select('*, publisher:publishers!original_publisher_id(*)').eq('id', id!).single(),
        supabase.from('volumes').select('*, publisher:publishers(*)').eq('series_id', id!).eq('ingest_status', 'published').order('volume_number'),
        supabase.from('reviews').select('*, profile:profiles(id,username,avatar_url,created_at)').eq('series_id', id!).limit(10),
      ])
      setSeries(seriesResult.data ?? MOCK_SERIES)
      setVolumes(volumesResult.data?.length ? (volumesResult.data as Volume[]) : MOCK_VOLUMES)
      setReviews(reviewsResult.data?.length ? (reviewsResult.data as Review[]) : MOCK_REVIEWS)

      if (volumesResult.data && volumesResult.data.length > 0) {
        const volumeIds = volumesResult.data.map(v => v.id)
        const { data: availData } = await supabase
          .from('volume_availability')
          .select('*, retailer:retailers(*)')
          .in('volume_id', volumeIds)
        if (availData) {
          setAvailability(availData as VolumeAvailability[])
        }
      }

      setLoading(false)

      if (user) {
        const { data: entry } = await supabase.from('library_entries').select('*').eq('user_id', user.id).eq('series_id', id!).single()
        setLibraryEntry(entry)
      }
    }
    if (id) load()
  }, [id, user])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const upsertLibraryEntry = async (updates: Partial<LibraryEntry>) => {
    if (!user) return
    setSavingStatus(true)
    const payload = { ...libraryEntry, ...updates, user_id: user.id, series_id: id }
    const { data, error } = await supabase.from('library_entries').upsert(payload, { onConflict: 'user_id,series_id' }).select().single()
    if (!error && data) {
      setLibraryEntry(data as LibraryEntry)
      showToast('Saved!')
    }
    setSavingStatus(false)
  }

  const s = series ?? MOCK_SERIES

  return (
    <>
      {/* Back */}
      <Link to="/discover" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-discover-btn">
        <ArrowLeft size={16} /> Back
      </Link>

      {/* ── Hero banner ──────────────────────────────── */}
      <section id="series-hero" className="animate-fade-in" style={{ position: 'relative', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 'var(--space-8)', minHeight: 300 }}>
        {/* Blurred bg cover */}
        {s.cover_url && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${s.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(32px) saturate(0.4)', transform: 'scale(1.1)', opacity: 0.4 }} aria-hidden="true" />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(13,15,20,0.95) 0%, rgba(13,15,20,0.7) 60%, transparent 100%)' }} />

        <div style={{ position: 'relative', display: 'flex', gap: 'var(--space-8)', padding: 'var(--space-8)', alignItems: 'flex-start' }}>
          {/* Cover */}
          <div style={{ width: 160, flexShrink: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}>
            {s.cover_url
              ? <img src={s.cover_url} alt={s.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : <div className="cover-placeholder" style={{ height: 240 }}><BookMarked size={40} /></div>
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {s.publisher && (
              <Link to={`/publishers/${s.publisher.id}`} className="badge badge-ink-green animate-fade-up" style={{ marginBottom: 'var(--space-3)', display: 'inline-flex', textDecoration: 'none' }}>
                {s.publisher.name}
              </Link>
            )}
            <h1 className="animate-fade-up delay-100" style={{ marginBottom: 8, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>{s.title}</h1>
            {s.original_title && <p className="animate-fade-up delay-100" style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>{s.original_title}</p>}

            {/* Chips */}
            <div className="animate-fade-up delay-200" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
              <span className={`badge ${s.status === 'ongoing' ? 'badge-slate' : s.status === 'completed' ? 'badge-ink-green' : 'badge-ochre'}`}>
                {s.status}
              </span>
              <span className="badge badge-neutral">{s.type}</span>
              {s._count?.volumes && <span className="badge badge-neutral">{s._count.volumes} volumes</span>}
            </div>

            {/* Stats row */}
            <div className="animate-fade-up delay-200" style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
              {s.avg_rating && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ochre)' }}>
                    <Star size={18} fill="currentColor" />{s.avg_rating.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rating</div>
                </div>
              )}
              {s._count?.readers && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink-green)' }}>{(s._count.readers / 1000).toFixed(1)}k</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><Eye size={11} style={{ display: 'inline' }} /> Readers</div>
                </div>
              )}
              {s._count?.owned && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--vermillion)' }}>{(s._count.owned / 1000).toFixed(1)}k</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><BookMarked size={11} style={{ display: 'inline' }} /> Owned</div>
                </div>
              )}
            </div>

            {/* ── Action bar ──────────────────────────── */}
            {user ? (
              <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Read status */}
                <select
                  id="read-status-select"
                  className="input select"
                  style={{ width: 'auto', padding: '8px 36px 8px 12px', background: libraryEntry?.read_status ? 'var(--ink-green-dim)' : undefined, borderColor: libraryEntry?.read_status ? 'var(--ink-green-border)' : undefined, color: libraryEntry?.read_status ? '#a78bfa' : undefined }}
                  value={libraryEntry?.read_status ?? ''}
                  disabled={savingStatus}
                  onChange={e => upsertLibraryEntry({ read_status: e.target.value as ReadStatus })}
                  aria-label="Reading status"
                >
                  <option value="">📖 Add to list…</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{READ_STATUS_LABELS[s]}</option>)}
                </select>

                {/* Owned toggle */}
                <button
                  id="owned-toggle-btn"
                  className={`btn ${libraryEntry?.owned ? 'active-owned status-toggle' : 'status-toggle'}`}
                  onClick={() => upsertLibraryEntry({ owned: !libraryEntry?.owned, read_status: libraryEntry?.read_status ?? 'plan_to_read' })}
                  disabled={savingStatus}
                  aria-pressed={!!libraryEntry?.owned}
                  title={libraryEntry?.owned ? 'Remove from shelf' : 'Add to shelf (own this series)'}
                >
                  <BookMarked size={15} />
                  {libraryEntry?.owned ? 'On shelf' : 'Add to shelf'}
                </button>

                {/* Rating */}
                <div style={{ display: 'flex', gap: 2 }} aria-label="Your rating" role="group">
                  {[1,2,3,4,5,6,7,8,9,10].filter(n => n % 2 === 0 || n === 1).map(n => (
                    <button
                      key={n}
                      className="btn btn-ghost"
                      style={{ padding: '0 2px', color: (libraryEntry?.personal_rating ?? 0) >= n ? 'var(--ochre)' : 'var(--text-muted)' }}
                      onClick={() => upsertLibraryEntry({ personal_rating: n, read_status: libraryEntry?.read_status ?? 'plan_to_read' })}
                      aria-label={`Rate ${n}`}
                      id={`rating-star-${n}`}
                    >
                      <Star size={18} fill={(libraryEntry?.personal_rating ?? 0) >= n ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary animate-fade-up delay-300" id="series-login-cta-btn">
                Sign in to track this series →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Description ─────────────────────────────── */}
      {s.description && (
        <section id="series-description" className="card animate-fade-up" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-3)' }}>About</h2>
          <p style={{ lineHeight: 1.8 }}>{s.description}</p>
        </section>
      )}

      {/* ── Volume grid ──────────────────────────────── */}
      <section id="volumes-section" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2><BookOpen size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Volumes</h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{volumes.length} volumes</span>
        </div>

        <div className="grid-covers" id="volumes-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={200} />)
            : volumes.map(vol => (
                <Link key={vol.id} to={`/volumes/${vol.id}`} className="volume-card animate-fade-up" id={`series-vol-card-${vol.id}`} style={{ textDecoration: 'none' }}>
                  <div className="volume-card-cover">
                    {vol.cover_url
                      ? <img src={vol.cover_url} alt={`Vol. ${vol.volume_number}`} loading="lazy" referrerPolicy="no-referrer" />
                      : <div className="cover-placeholder"><BookMarked size={24} /></div>
                    }
                    <div className="volume-card-cover-overlay" />
                    <div className="volume-card-actions">
                      <span className="badge badge-neutral" style={{ fontSize: '0.625rem' }}>Vol. {vol.volume_number}</span>
                    </div>
                  </div>
                  <div className="volume-card-body">
                    <div className="volume-card-title">Vol. {vol.volume_number}</div>
                    <div className="volume-card-meta">{vol.release_date ? new Date(vol.release_date).getFullYear() : '—'}</div>
                  </div>
                </Link>
              ))
          }
        </div>
      </section>

      {/* ── Where to buy ─────────────────────────────── */}
      <section id="where-to-buy-section" className="card animate-fade-up" style={{ marginBottom: 'var(--space-8)', overflow: 'hidden' }}>
        <button
          id="where-to-buy-toggle"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5) var(--space-6)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
          onClick={() => setWhereToBuyOpen(o => !o)}
          aria-expanded={whereToByOpen}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.125rem' }}>
            <ShoppingBag size={20} style={{ color: 'var(--vermillion)' }} /> Where to Buy
          </span>
          {whereToByOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {whereToByOpen && (
          <div style={{ padding: '0 var(--space-6) var(--space-6)' }}>
            {availability.length > 0 ? (
              <table className="table">
                <thead><tr><th>Region</th><th>Retailer</th><th>Status</th><th>Link</th></tr></thead>
                <tbody>
                  {availability.map(a => (
                    <tr key={a.id}>
                      <td>{a.region_code}</td>
                      <td>{a.retailer?.name}</td>
                      <td><span className={`badge ${a.in_print ? 'badge-slate' : 'badge-neutral'}`}>{a.in_print ? 'In Print' : 'Unknown'}</span></td>
                      <td>{a.product_url && <a href={a.product_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" id={`buy-link-${a.id}`}><ExternalLink size={12} /> View</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-icon"><ShoppingBag size={28} /></div>
                <p>Availability data not yet curated for this series.</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Check individual volume pages for specific retailer links.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Reviews ──────────────────────────────────── */}
      <section id="reviews-section" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2>Reviews</h2>
          {user && <button className="btn btn-primary btn-sm" id="write-review-btn" onClick={() => alert('Review editor coming soon!')}>Write a review</button>}
        </div>

        {reviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Star size={28} /></div>
            <p>No reviews yet. Be the first!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {reviews.map(review => (
              <div key={review.id} className="card animate-fade-up" style={{ padding: 'var(--space-5)' }} id={`review-${review.id}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div className="avatar avatar-sm">{review.profile?.username[0].toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{review.profile?.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  {review.rating && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ochre)', fontWeight: 700 }}>
                      <Star size={14} fill="currentColor" /> {review.rating}/10
                    </div>
                  )}
                  {review.contains_spoilers && <span className="badge badge-ochre">Spoilers</span>}
                </div>
                <p style={{ lineHeight: 1.75 }}>{review.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span style={{ color: 'var(--slate)', fontSize: '1.25rem' }}>✓</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </>
  )
}
