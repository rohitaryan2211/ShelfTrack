import { useEffect, useState } from 'react'
import { Compass, SlidersHorizontal, Layers, Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import type { Series, SeriesGenre } from '../lib/types'
import { GENRE_LABELS } from '../lib/types'

type StatusFilter = 'all' | 'ongoing' | 'completed' | 'hiatus'
type GenreFilter = 'all' | SeriesGenre

export default function DiscoverPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [genreFilter, setGenreFilter] = useState<GenreFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)

      let query = supabase
        .from('series')
        .select(`
          *,
          publisher:publishers!original_publisher_id(id, name, country)
        `)
        .eq('ingest_status', 'published')
        .order('title', { ascending: true })
        .limit(200)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (genreFilter !== 'all') {
        query = query.eq('genre', genreFilter)
      }

      const { data } = await query
      setSeries((data as Series[]) ?? [])
      setLoading(false)
    }
    load()
  }, [statusFilter, genreFilter])

  // Client-side search filter
  const filtered = searchQuery.trim()
    ? series.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.original_title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : series

  // Compute active genre counts from current results (before genre filter)
  const genreCounts = series.reduce<Record<string, number>>((acc, s) => {
    const g = s.genre ?? 'other'
    acc[g] = (acc[g] || 0) + 1
    return acc
  }, {})

  return (
    <>
      {/* Page header */}
      <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
            <Compass size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
            Discover
          </h1>
          <p>Browse the full manga catalog — find your next series to read.</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="input-group" style={{ maxWidth: 480, marginBottom: 'var(--space-4)' }}>
        <Search size={18} className="input-icon" />
        <input
          id="discover-search"
          type="search"
          className="input"
          placeholder="Filter series by name…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ height: 46, fontSize: '0.9375rem' }}
        />
      </div>

      {/* Filters */}
      <div
        id="discover-filters"
        className="card animate-fade-in"
        style={{
          padding: 'var(--space-3) var(--space-5)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {(['all', 'ongoing', 'completed', 'hiatus'] as StatusFilter[]).map(s => (
            <button
              key={s}
              id={`filter-status-${s}`}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 24,
            background: 'var(--border-default)',
            flexShrink: 0,
          }}
        />

        {/* Genre filter */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Layers size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <button
            id="filter-genre-all"
            className={`btn btn-sm ${genreFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGenreFilter('all')}
          >
            All Genres
          </button>
          {Object.entries(GENRE_LABELS).map(([key, label]) => (
            <button
              key={key}
              id={`filter-genre-${key}`}
              className={`btn btn-sm ${genreFilter === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGenreFilter(key as SeriesGenre)}
            >
              {label}
              {genreCounts[key] ? ` · ${genreCounts[key]}` : ''}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} series
        </span>
      </div>

      {/* Grid of series cards */}
      {loading ? (
        <div className="discover-grid" id="discover-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} height={220} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state animate-fade-up" style={{ paddingTop: 'var(--space-10)' }}>
          <div className="empty-state-icon"><Compass size={32} /></div>
          <h3>No series found</h3>
          <p>
            {searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'No published series match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="discover-grid" id="discover-grid">
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
            >
              <SeriesCard series={s} size="fill" />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
