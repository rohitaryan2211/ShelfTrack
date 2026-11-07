import { useCallback, useEffect, useState } from 'react'
import { Compass, SlidersHorizontal, Layers, Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { SeriesCard, SkeletonCard } from '../../components/Cards'
import type { Series, SeriesGenre } from '../../lib/types'
import { GENRE_LABELS } from '../../lib/types'

type StatusFilter = 'all' | 'ongoing' | 'completed' | 'hiatus'
type GenreFilter = 'all' | SeriesGenre

type SortKey = 'popular' | 'score' | 'title' | 'newest'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Most popular' },
  { key: 'score', label: 'Highest rated' },
  { key: 'newest', label: 'Newest' },
  { key: 'title', label: 'A–Z' },
]
const PAGE_SIZE = 48

// PostgREST `or` filters use commas and parentheses as syntax; strip them from user input.
const sanitize = (q: string) => q.replace(/[,()*%\\]/g, ' ').trim()

export default function DiscoverPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [genreFilter, setGenreFilter] = useState<GenreFilter>('all')
  const [sort, setSort] = useState<SortKey>('popular')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce typing → query
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(sanitize(searchInput)), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchPage = useCallback(async (offset: number) => {
    let query = supabase
      .from('series')
      .select('*, publisher:publishers!original_publisher_id(id, name, country)', { count: 'exact' })
      .eq('ingest_status', 'published')

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (genreFilter !== 'all') query = query.eq('genre', genreFilter)
    if (searchQuery) {
      const like = `%${searchQuery}%`
      query = query.or(`title.ilike.${like},original_title.ilike.${like},author.ilike.${like}`)
    }

    if (sort === 'popular') query = query.order('popularity', { ascending: false, nullsFirst: false })
    else if (sort === 'score') query = query.order('average_score', { ascending: false, nullsFirst: false })
    else if (sort === 'newest') query = query.order('start_year', { ascending: false, nullsFirst: false })
    query = query.order('title', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)

    const { data, count } = await query
    return { rows: (data as Series[]) ?? [], count: count ?? 0 }
  }, [statusFilter, genreFilter, sort, searchQuery])

  useEffect(() => {
    let cancelled = false
    fetchPage(0).then(({ rows, count }) => {
      if (cancelled) return
      setSeries(rows)
      setTotal(count)
      setHasMore(rows.length < count)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [fetchPage])

  const loadMore = async () => {
    setLoadingMore(true)
    const { rows, count } = await fetchPage(series.length)
    setSeries(prev => [...prev, ...rows])
    setHasMore(series.length + rows.length < count)
    setLoadingMore(false)
  }

  const changeFilter = <T,>(setter: (v: T) => void) => (v: T) => { setLoading(true); setter(v) }
  const setStatus = changeFilter(setStatusFilter)
  const setGenre = changeFilter(setGenreFilter)
  const setSortKey = changeFilter(setSort)

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
          placeholder="Search by title or author…"
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setLoading(true) }}
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
              onClick={() => setStatus(s)}
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
            onClick={() => setGenre('all')}
          >
            All Genres
          </button>
          {Object.entries(GENRE_LABELS).map(([key, label]) => (
            <button
              key={key}
              id={`filter-genre-${key}`}
              className={`btn btn-sm ${genreFilter === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGenre(key as SeriesGenre)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <select
          id="discover-sort"
          className="input select"
          style={{ width: 'auto', height: 34, padding: '0 32px 0 12px', fontSize: '0.8125rem' }}
          value={sort}
          onChange={e => setSortKey(e.target.value as SortKey)}
          aria-label="Sort"
        >
          {SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {total ?? '…'} series
        </span>
      </div>

      {/* Grid of series cards */}
      {loading ? (
        <div className="discover-grid" id="discover-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} height={220} />
          ))}
        </div>
      ) : series.length === 0 ? (
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
          {series.map((s, i) => (
            <div
              key={s.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i % PAGE_SIZE, 20) * 30}ms` }}
            >
              <SeriesCard series={s} size="fill" />
            </div>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-8)' }}>
          <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore} id="discover-load-more">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  )
}
