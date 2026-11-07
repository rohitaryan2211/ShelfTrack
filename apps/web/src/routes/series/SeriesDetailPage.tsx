import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, BookMarked, Eye, Star, ChevronDown, ChevronUp, BookOpen, Globe, PenLine, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import type { Series, SeriesStats, Volume, Review, LibraryEntry, ReadStatus } from '../../lib/types'
import { READ_STATUS_LABELS, GENRE_LABELS } from '../../lib/types'
import { getRegionLabel } from '../../lib/regionLabels'

const STATUS_OPTIONS: ReadStatus[] = ['plan_to_read', 'reading', 'completed', 'dropped', 'on_hold']

// ─── Volumes grouped by region ────────────────────────────
interface VolumesSectionProps {
  series: Series
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
                  </div>
                  <div className="volume-card-body">
                    <div className="volume-card-title">
                      Vol. {vol.volume_number}
                    </div>
                    <div className="volume-card-meta">
                      {vol.publisher?.name && <span className="truncate">{vol.publisher.name}</span>}
                      {vol.release_date && <span>{new Date(vol.release_date).getFullYear()}</span>}
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

// ─── 10-point rating as five half-able stars ──────────────
function StarRating({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="star-rating" role="radiogroup" aria-label="Your rating out of 10" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(star => {
        const full = shown >= star * 2
        const half = !full && shown >= star * 2 - 1
        return (
          <span key={star} className="star-rating-star">
            <Star size={20} fill={full ? 'currentColor' : 'none'} className={full || half ? 'is-on' : ''} />
            {half && <Star size={20} fill="currentColor" className="star-rating-half is-on" />}
            {[star * 2 - 1, star * 2].map(v => (
              <button
                key={v}
                type="button"
                className={`star-rating-hit ${v % 2 ? 'left' : 'right'}`}
                aria-label={`${v} out of 10`}
                aria-checked={value === v}
                role="radio"
                disabled={disabled}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onBlur={() => setHover(null)}
                onClick={() => onChange(value === v ? null : v)}
              />
            ))}
          </span>
        )
      })}
      <span className="star-rating-value">{value ? `${value}/10` : 'Rate'}</span>
    </div>
  )
}

// ─── Review editor ────────────────────────────────────────
interface ReviewEditorProps {
  seriesId: string
  userId: string
  existing: Review | null
  defaultRating: number | null
  onSaved: (r: Review | null) => void
  onClose: () => void
}

function ReviewEditor({ seriesId, userId, existing, defaultRating, onSaved, onClose }: ReviewEditorProps) {
  const [body, setBody] = useState(existing?.body ?? '')
  const [rating, setRating] = useState<number | null>(existing?.rating ?? defaultRating)
  const [spoilers, setSpoilers] = useState(existing?.contains_spoilers ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (body.trim().length < 10) { setError('Write at least a sentence (10+ characters).'); return }
    setSaving(true)
    setError(null)
    const payload = { body: body.trim(), rating, contains_spoilers: spoilers }
    const res = existing
      ? await supabase.from('reviews').update(payload).eq('id', existing.id).select('*, profile:profiles(id,username,avatar_url,created_at)').single()
      : await supabase.from('reviews').insert({ ...payload, user_id: userId, series_id: seriesId }).select('*, profile:profiles(id,username,avatar_url,created_at)').single()
    setSaving(false)
    if (res.error) { setError(res.error.message); return }
    onSaved(res.data as Review)
  }

  const remove = async () => {
    if (!existing || !confirm('Delete your review?')) return
    setSaving(true)
    const { error } = await supabase.from('reviews').delete().eq('id', existing.id)
    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved(null)
  }

  return (
    <form className="card animate-fade-up" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }} onSubmit={save} id="review-editor">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <label className="label" htmlFor="review-body">{existing ? 'Edit your review' : 'Your review'}</label>
      <textarea
        id="review-body"
        className="input"
        style={{ minHeight: 130, resize: 'vertical', marginBottom: 'var(--space-4)' }}
        placeholder="What did you think?"
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={5000}
        autoFocus
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
          <StarRating value={rating} onChange={setRating} disabled={saving} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={spoilers} onChange={e => setSpoilers(e.target.checked)} style={{ accentColor: 'var(--ochre)' }} />
            Contains spoilers
          </label>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {existing && <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={remove} disabled={saving}><Trash2 size={14} /> Delete</button>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : existing ? 'Update' : 'Publish'}</button>
        </div>
      </div>
    </form>
  )
}

function ReviewCard({ review }: { review: Review }) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers)
  return (
    <div className="card animate-fade-up" style={{ padding: 'var(--space-5)' }} id={`review-${review.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Link to={`/profile/${review.profile?.username ?? ''}`} className="avatar avatar-sm" style={{ textDecoration: 'none' }}>
          {review.profile?.username?.[0]?.toUpperCase() ?? '?'}
        </Link>
        <div>
          <Link to={`/profile/${review.profile?.username ?? ''}`} style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
            @{review.profile?.username ?? 'reader'}
          </Link>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        {review.contains_spoilers && <span className="badge badge-ochre">Spoilers</span>}
        {review.rating != null && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ochre)', fontWeight: 700 }}>
            <Star size={14} fill="currentColor" /> {review.rating}/10
          </div>
        )}
      </div>
      {revealed
        ? <p style={{ lineHeight: 1.75, whiteSpace: 'pre-line' }}>{review.body}</p>
        : <button className="btn btn-secondary btn-sm" onClick={() => setRevealed(true)}>Show review with spoilers</button>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────
export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [series, setSeries] = useState<Series | null>(null)
  const [stats, setStats] = useState<SeriesStats | null>(null)
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [libraryEntry, setLibraryEntry] = useState<LibraryEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [editingReview, setEditingReview] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      const [seriesResult, volumesResult, reviewsResult, statsResult] = await Promise.all([
        supabase.from('series').select('*, publisher:publishers!original_publisher_id(*)').eq('id', id!).maybeSingle(),
        supabase.from('volumes').select('*, publisher:publishers(*)').eq('series_id', id!).eq('ingest_status', 'published').order('volume_number').limit(1000),
        supabase.from('reviews').select('*, profile:profiles(id,username,avatar_url,created_at)').eq('series_id', id!).order('created_at', { ascending: false }).limit(20),
        supabase.from('series_stats').select('*').eq('series_id', id!).maybeSingle(),
      ])
      const entry = user
        ? (await supabase.from('library_entries').select('*').eq('user_id', user.id).eq('series_id', id!).maybeSingle()).data
        : null
      if (cancelled) return
      setSeries(seriesResult.data as Series | null)
      setVolumes((volumesResult.data as Volume[]) ?? [])
      setReviews((reviewsResult.data as Review[]) ?? [])
      setStats(statsResult.data as SeriesStats | null)
      setLibraryEntry(entry as LibraryEntry | null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id, user])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const saveEntry = async (updates: Partial<LibraryEntry>) => {
    if (!user || !id) return
    setSavingStatus(true)
    const { data, error } = await supabase
      .from('library_entries')
      .upsert(
        { user_id: user.id, series_id: id, read_status: libraryEntry?.read_status ?? 'plan_to_read', ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,series_id' },
      )
      .select()
      .single()
    setSavingStatus(false)
    if (error) { showToast(`Error: ${error.message}`); return }
    setLibraryEntry(data as LibraryEntry)
    showToast('Saved')
  }

  const removeEntry = async () => {
    if (!user || !libraryEntry) return
    setSavingStatus(true)
    const { error } = await supabase.from('library_entries').delete().eq('id', libraryEntry.id)
    setSavingStatus(false)
    if (error) { showToast(`Error: ${error.message}`); return }
    setLibraryEntry(null)
    showToast('Removed from your list')
  }

  const myReview = user ? reviews.find(r => r.user_id === user.id) ?? null : null

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
  const volumeCount = s.volume_count ?? new Set(volumes.map(v => Number(v.volume_number))).size
  const description = s.description ?? ''
  const longDescription = description.length > 420

  return (
    <>
      <Link to="/discover" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-discover-btn">
        <ArrowLeft size={16} /> Discover
      </Link>

      {/* ── Hero ─────────────────────────────────────── */}
      <section id="series-hero" className="series-hero animate-fade-in">
        {s.cover_url && <div className="series-hero-bg" style={{ backgroundImage: `url(${s.cover_url})` }} aria-hidden="true" />}
        <div className="series-hero-shade" />

        <div className="series-hero-inner">
          <div className="series-hero-cover">
            {s.cover_url
              ? <img src={s.cover_url} alt={s.title} referrerPolicy="no-referrer" />
              : <div className="cover-placeholder" style={{ height: 240 }}><BookMarked size={40} /></div>}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {s.publisher && (
              <Link to={`/publishers/${s.publisher.id}`} className="badge badge-ink-green" style={{ marginBottom: 'var(--space-3)', display: 'inline-flex', textDecoration: 'none' }}>
                {s.publisher.name}
              </Link>
            )}
            <h1 style={{ marginBottom: 6, fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>{s.title}</h1>
            {s.original_title && s.original_title !== s.title && (
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>{s.original_title}</p>
            )}
            {s.author && (
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PenLine size={14} /> {s.author}
              </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
              <span className={`badge ${s.status === 'ongoing' ? 'badge-slate' : s.status === 'completed' ? 'badge-ink-green' : 'badge-ochre'}`}>{s.status}</span>
              {s.genre && s.genre !== 'other' && <span className="badge badge-vermillion">{GENRE_LABELS[s.genre]}</span>}
              {volumeCount > 0 && <span className="badge badge-neutral">{volumeCount} volumes</span>}
              {s.chapter_count ? <span className="badge badge-neutral">{s.chapter_count} chapters</span> : null}
              {s.start_year && <span className="badge badge-neutral">{s.start_year}</span>}
            </div>

            <div className="series-stats">
              {s.average_score != null && (
                <div title="Average score on AniList">
                  <div className="series-stat-value" style={{ color: 'var(--ochre)' }}><Star size={18} fill="currentColor" />{(s.average_score / 10).toFixed(1)}</div>
                  <div className="series-stat-label">Score</div>
                </div>
              )}
              {stats?.avg_rating != null && (
                <div title="Average ShelfTrack rating">
                  <div className="series-stat-value" style={{ color: 'var(--ochre)' }}>{Number(stats.avg_rating).toFixed(1)}</div>
                  <div className="series-stat-label">Our readers</div>
                </div>
              )}
              <div>
                <div className="series-stat-value" style={{ color: 'var(--text-primary)' }}>{stats?.readers ?? 0}</div>
                <div className="series-stat-label"><Eye size={11} style={{ display: 'inline' }} /> Tracking</div>
              </div>
              <div>
                <div className="series-stat-value" style={{ color: 'var(--vermillion)' }}>{stats?.owners ?? 0}</div>
                <div className="series-stat-label"><BookMarked size={11} style={{ display: 'inline' }} /> Collectors</div>
              </div>
            </div>

            {user ? (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  id="read-status-select"
                  className={`input select read-status-select ${libraryEntry?.read_status ? 'is-set' : ''}`}
                  value={libraryEntry?.read_status ?? ''}
                  disabled={savingStatus}
                  onChange={e => {
                    const v = e.target.value
                    if (v === '__remove') removeEntry()
                    else if (v) saveEntry({ read_status: v as ReadStatus })
                  }}
                  aria-label="Reading status"
                >
                  <option value="" disabled>Add to list…</option>
                  {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{READ_STATUS_LABELS[opt]}</option>)}
                  {libraryEntry && <option value="__remove">Remove from list</option>}
                </select>
                <StarRating
                  value={libraryEntry?.personal_rating ?? null}
                  disabled={savingStatus}
                  onChange={v => saveEntry({ personal_rating: v })}
                />
              </div>
            ) : (
              <Link to="/login" state={{ from: `/series/${s.id}` }} className="btn btn-primary" id="series-login-cta-btn">
                Sign in to track this series →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Description ─────────────────────────────── */}
      {description && (
        <section id="series-description" className="card animate-fade-up" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-3)' }}>About</h2>
          <p style={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {longDescription && !descExpanded ? `${description.slice(0, 420).trimEnd()}…` : description}
          </p>
          {longDescription && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={() => setDescExpanded(x => !x)}>
              {descExpanded ? <>Show less <ChevronUp size={14} /></> : <>Read more <ChevronDown size={14} /></>}
            </button>
          )}
          {s.genres && s.genres.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
              {s.genres.map(g => <span key={g} className="badge badge-neutral">{g}</span>)}
            </div>
          )}
        </section>
      )}

      <VolumesSection series={series} volumes={volumes} regionFilter={regionFilter} setRegionFilter={setRegionFilter} />

      {/* ── Reviews ──────────────────────────────────── */}
      <section id="reviews-section" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="section-header">
          <h2>Reviews</h2>
          {user && !editingReview && (
            <button className="btn btn-primary btn-sm" id="write-review-btn" onClick={() => setEditingReview(true)}>
              {myReview ? 'Edit your review' : 'Write a review'}
            </button>
          )}
        </div>

        {user && editingReview && (
          <ReviewEditor
            seriesId={s.id}
            userId={user.id}
            existing={myReview}
            defaultRating={libraryEntry?.personal_rating ?? null}
            onClose={() => setEditingReview(false)}
            onSaved={saved => {
              setReviews(prev => {
                const others = prev.filter(r => r.user_id !== user.id)
                return saved ? [saved, ...others] : others
              })
              setEditingReview(false)
              showToast(saved ? 'Review saved' : 'Review deleted')
            }}
          />
        )}

        {reviews.length === 0 && !editingReview ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Star size={28} /></div>
            <p>No reviews yet. {user ? 'Be the first!' : <Link to="/login" state={{ from: `/series/${s.id}` }}>Sign in</Link>}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {reviews.map(review => <ReviewCard key={review.id} review={review} />)}
          </div>
        )}
      </section>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span style={{ color: 'var(--slate)', fontSize: '1.25rem' }}>✓</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </>
  )
}
