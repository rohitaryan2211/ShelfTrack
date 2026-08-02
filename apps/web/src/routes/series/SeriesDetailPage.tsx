import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, BookMarked, Eye, Star, ShoppingBag,
  ChevronDown, ChevronUp, ExternalLink, BookOpen, Globe
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import type { Series, Volume, Review, LibraryEntry, ReadStatus, VolumeAvailability } from '../../lib/types'
import { READ_STATUS_LABELS } from '../../lib/types'
import { getRegionLabel } from '../../lib/regionLabels'



const STATUS_OPTIONS: ReadStatus[] = ['plan_to_read', 'reading', 'completed', 'dropped', 'on_hold']

// ─── Volumes grouped by region ────────────────────────────
interface VolumesSectionProps {
  volumes: Volume[]
  regionFilter: string
  setRegionFilter: (v: string) => void
}

function VolumesSection({ volumes, regionFilter, setRegionFilter }: VolumesSectionProps) {
  // Compute distinct regions from volumes
  const regionGroups = useMemo(() => {
    const map = new Map<string, Volume[]>()
    volumes.forEach(v => {
      const key = v.region_code ?? 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v)
    })
    // Sort: JP first (original), then alphabetical
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => {
      if (a === 'JP') return -1
      if (b === 'JP') return 1
      return a.localeCompare(b)
    })
    return entries
  }, [volumes])

  const regionCodes = regionGroups.map(([code]) => code)

  const visibleGroups =
    regionFilter === 'all'
      ? regionGroups
      : regionGroups.filter(([code]) => code === regionFilter)

  return (
    <section id="volumes-section" style={{ marginBottom: 'var(--space-8)' }}>
      <div className="section-header">
        <h2>
          <BookOpen size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />
          Volumes
        </h2>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {volumes.length} volumes · {regionCodes.length} {regionCodes.length === 1 ? 'region' : 'regions'}
        </span>
      </div>

      {/* Region filter pills */}
      {regionCodes.length > 1 && (
        <div
          id="region-filter-pills"
          className="animate-fade-in"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            marginBottom: 'var(--space-6)',
          }}
        >
          <button
            id="region-pill-all"
            className={`btn btn-sm ${regionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRegionFilter('all')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Globe size={13} /> All Regions
          </button>
          {regionCodes.map(code => (
            <button
              key={code}
              id={`region-pill-${code}`}
              className={`btn btn-sm ${regionFilter === code ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRegionFilter(code)}
            >
              {getRegionLabel(code)}
            </button>
          ))}
        </div>
      )}

      {volumes.length > 0 ? (
        visibleGroups.map(([code, regionVolumes], groupIdx) => (
          <div
            key={code}
            className="animate-fade-up"
            style={{
              marginBottom: 'var(--space-8)',
              animationDelay: `${groupIdx * 80}ms`,
            }}
          >
            {/* Region sub-header */}
            {regionGroups.length > 1 && (
              <div
                id={`region-header-${code}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  paddingBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <Globe size={16} style={{ color: 'var(--slate)', flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {getRegionLabel(code)}
                </span>
                <span
                  className="badge badge-neutral"
                  style={{ fontSize: '0.6875rem' }}
                >
                  {regionVolumes.length} vol{regionVolumes.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Volume grid for this region */}
            <div className="grid-covers" id={`volumes-grid-${code}`}>
              {regionVolumes.map(vol => (
                <Link
                  key={vol.id}
                  to={`/volumes/${vol.id}`}
                  className="volume-card animate-fade-up"
                  id={`series-vol-card-${vol.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className="volume-card-cover">
                    {vol.cover_url ? (
                      <img
                        src={vol.cover_url}
                        alt={`Vol. ${vol.volume_number}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="cover-placeholder">
                        <BookMarked size={24} />
                      </div>
                    )}
                    <div className="volume-card-cover-overlay" />
                    <div className="volume-card-actions">
                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: '0.625rem' }}
                      >
                        Vol. {vol.volume_number}
                      </span>
                    </div>
                  </div>
                  <div className="volume-card-body">
                    <div className="volume-card-title">
                      Vol. {vol.volume_number}
                    </div>
                    <div className="volume-card-meta">
                      {vol.release_date
                        ? new Date(vol.release_date).getFullYear()
                        : '—'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
          <div className="empty-state-icon">
            <BookOpen size={28} />
          </div>
          <p>No volumes listed for this series yet.</p>
        </div>
      )}
    </section>
  )
}

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
  const [regionFilter, setRegionFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const [seriesResult, volumesResult, reviewsResult] = await Promise.all([
        supabase.from('series').select('*, publisher:publishers!original_publisher_id(*)').eq('id', id!).single(),
        supabase.from('volumes').select('*, publisher:publishers(*)').eq('series_id', id!).eq('ingest_status', 'published').order('volume_number'),
        supabase.from('reviews').select('*, profile:profiles(id,username,avatar_url,created_at)').eq('series_id', id!).limit(10),
      ])
      setSeries(seriesResult.data as Series | null)
      setVolumes((volumesResult.data as Volume[]) ?? [])
      setReviews((reviewsResult.data as Review[]) ?? [])

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
        const { data: entry } = await supabase.from('library_entries').select('*').eq('user_id', user.id).eq('series_id', id!).maybeSingle()
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
    let error = null
    let updatedEntry = null

    const existingId = libraryEntry?.id
    if (existingId) {
      const res = await supabase.from('library_entries').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existingId).select().maybeSingle()
      error = res.error
      updatedEntry = res.data
    } else {
      const check = await supabase.from('library_entries').select('id').eq('user_id', user.id).eq('series_id', id!).maybeSingle()
      if (check.data?.id) {
        const res = await supabase.from('library_entries').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', check.data.id).select().maybeSingle()
        error = res.error
        updatedEntry = res.data
      } else {
        const res = await supabase.from('library_entries').insert({ ...updates, user_id: user.id, series_id: id }).select().maybeSingle()
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
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-xl)' }} />
      </div>
    )
  }

  if (!series) {
    return (
      <>
        <Link to="/discover" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Discover
        </Link>
        <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
          <div className="empty-state-icon"><BookMarked size={28} /></div>
          <h3>Series not found</h3>
          <p>The requested series does not exist or has not been published in the catalog.</p>
        </div>
      </>
    )
  }

  const s = series

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

      {/* ── Volume grid — grouped by region ─────────── */}
      <VolumesSection volumes={volumes} regionFilter={regionFilter} setRegionFilter={setRegionFilter} />

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
