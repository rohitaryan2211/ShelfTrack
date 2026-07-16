import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, BookMarked, Eye, Clock, Bookmark, XCircle, Grid, List } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { LibraryEntry, ReadStatus } from '../lib/types'
import { READ_STATUS_LABELS } from '../lib/types'

type ActiveTab = 'all' | ReadStatus | 'owned'
type ViewMode = 'grid' | 'list'

const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
  { key: 'all',          label: 'All',          icon: <Library size={15} /> },
  { key: 'owned',        label: 'Shelf',         icon: <BookMarked size={15} /> },
  { key: 'reading',      label: 'Reading',       icon: <Eye size={15} /> },
  { key: 'completed',    label: 'Completed',     icon: <Eye size={15} /> },
  { key: 'plan_to_read', label: 'Plan to Read',  icon: <Clock size={15} /> },
  { key: 'on_hold',      label: 'On Hold',       icon: <Bookmark size={15} /> },
  { key: 'dropped',      label: 'Dropped',       icon: <XCircle size={15} /> },
]

export default function LibraryPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      let query = supabase
        .from('library_entries')
        .select('*, series:series(id,title,cover_url,status,type), volume:volumes(id,volume_number,cover_url,series_id)')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })

      if (activeTab === 'owned') {
        query = query.eq('owned', true)
      } else if (activeTab !== 'all') {
        query = query.eq('read_status', activeTab as ReadStatus)
      }

      const { data } = await query
      setEntries((data ?? []) as LibraryEntry[])
      setLoading(false)
    }
    load()
  }, [user, activeTab])

  const stats = {
    total: entries.length,
    owned: entries.filter(e => e.owned).length,
    read: entries.filter(e => e.read_status === 'completed').length,
    avgRating: entries.filter(e => e.personal_rating).reduce((sum, e) => sum + (e.personal_rating ?? 0), 0) / (entries.filter(e => e.personal_rating).length || 1),
  }

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>
          <Library size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
          My Library
        </h1>
        <p>Your personal reading & collection tracker.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total tracked', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Volumes owned', value: stats.owned, color: 'var(--vermillion)' },
          { label: 'Completed', value: stats.read, color: 'var(--ink-green)' },
          { label: 'Avg rating', value: stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} ★` : '—', color: 'var(--ochre)' },
        ].map((s, i) => (
          <div key={i} className="card animate-fade-up" style={{ padding: 'var(--space-5)', textAlign: 'center', animationDelay: `${i * 60}ms` }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.75rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + View mode */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
        <div className="tabs" style={{ flex: 1, margin: 0, overflowX: 'auto' }} id="library-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} id={`library-tab-${t.key}`} onClick={() => setActiveTab(t.key)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t.icon}{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginLeft: 'var(--space-4)', flexShrink: 0 }}>
          <button className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} id="view-grid-btn" onClick={() => setViewMode('grid')} title="Grid view"><Grid size={16} /></button>
          <button className={`btn btn-icon ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} id="view-list-btn" onClick={() => setViewMode('list')} title="List view"><List size={16} /></button>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        {loading && (
          viewMode === 'grid'
            ? <div className="grid-covers-lg">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '2/3', borderRadius: 'var(--radius-lg)' }} />)}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />)}</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="empty-state animate-fade-up" style={{ paddingTop: 'var(--space-12)' }}>
            <div className="empty-state-icon" style={{ width: 80, height: 80 }}><Library size={36} /></div>
            <h3>Your shelf is empty</h3>
            <p>Start by discovering series and marking volumes as read or owned.</p>
            <Link to="/discover" className="btn btn-primary" id="library-empty-discover-btn">Browse catalog</Link>
          </div>
        )}

        {!loading && entries.length > 0 && viewMode === 'grid' && (
          <div className="grid-covers-lg" id="library-grid">
            {entries.map((entry, i) => {
              const cover = entry.series?.cover_url ?? entry.volume?.cover_url
              const title = entry.series?.title ?? `Vol. ${entry.volume?.volume_number}`
              const href = entry.series_id ? `/series/${entry.series_id}` : `/volumes/${entry.volume_id}`
              return (
                <Link key={entry.id} to={href} className="volume-card animate-fade-up" style={{ textDecoration: 'none', animationDelay: `${i * 30}ms` }} id={`library-entry-${entry.id}`}>
                  <div className="volume-card-cover">
                    {cover ? <img src={cover} alt={title} loading="lazy" referrerPolicy="no-referrer" /> : <div className="cover-placeholder"><BookMarked size={28} /></div>}
                    <div className="volume-card-cover-overlay" />
                    <div className="volume-card-actions">
                      {entry.owned && <span className="badge badge-vermillion"><BookMarked size={10} /> Owned</span>}
                    </div>
                  </div>
                  <div className="volume-card-body">
                    <div className="volume-card-title" title={title}>{title}</div>
                    <div className="volume-card-meta">
                      <span className={`badge ${entry.read_status === 'completed' ? 'badge-ink-green' : entry.read_status === 'reading' ? 'badge-slate' : 'badge-neutral'}`} style={{ fontSize: '0.625rem' }}>
                        {READ_STATUS_LABELS[entry.read_status]}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {!loading && entries.length > 0 && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} id="library-list">
            {entries.map((entry, i) => {
              const cover = entry.series?.cover_url ?? entry.volume?.cover_url
              const title = entry.series?.title ?? `Vol. ${entry.volume?.volume_number}`
              const href = entry.series_id ? `/series/${entry.series_id}` : `/volumes/${entry.volume_id}`
              return (
                <Link key={entry.id} to={href} className="card card-hover animate-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3)', textDecoration: 'none', animationDelay: `${i * 30}ms` }} id={`library-list-entry-${entry.id}`}>
                  <div style={{ width: 44, height: 64, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface)' }}>
                    {cover ? <img src={cover} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" referrerPolicy="no-referrer" /> : <div className="cover-placeholder"><BookMarked size={18} /></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`badge ${entry.read_status === 'completed' ? 'badge-ink-green' : entry.read_status === 'reading' ? 'badge-slate' : 'badge-neutral'}`}>
                        {READ_STATUS_LABELS[entry.read_status]}
                      </span>
                      {entry.owned && <span className="badge badge-vermillion"><BookMarked size={10} /> Owned</span>}
                    </div>
                  </div>
                  {entry.personal_rating && (
                    <div style={{ color: 'var(--ochre)', fontWeight: 700, fontSize: '0.9375rem', flexShrink: 0 }}>★ {entry.personal_rating}</div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
