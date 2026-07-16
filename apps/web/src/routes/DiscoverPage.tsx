import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, SlidersHorizontal, BookOpen, ArrowRight } from 'lucide-react'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import { supabase } from '../lib/supabaseClient'
import type { Series } from '../lib/types'

type SortOption = 'newest' | 'rating' | 'most_read' | 'most_owned' | 'alpha'
type StatusFilter = 'all' | 'ongoing' | 'completed' | 'hiatus'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  rating: 'Highest Rated',
  most_read: 'Most Read',
  most_owned: 'Most Owned',
  alpha: 'A → Z',
}

// Fallback mock data
const MOCK_SERIES: Series[] = [
  { id: '1', title: 'One Piece', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.2, _count: { volumes: 108, readers: 12400, owned: 8900 } },
  { id: '2', title: 'Jujutsu Kaisen', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113138-G8C1GFrUUB0c.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.8, _count: { volumes: 27, readers: 9800, owned: 6200 } },
  { id: '3', title: 'Demon Slayer', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx87216-NfA0GHSb1dxV.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.6, _count: { volumes: 23, readers: 11200, owned: 9400 } },
  { id: '4', title: 'My Hero Academia', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx75989-JBqEHHFIQiQ6.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.1, _count: { volumes: 41, readers: 8700, owned: 6100 } },
  { id: '5', title: 'Chainsaw Man', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113755-NnH1F5Z5BFZJ.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.0, _count: { volumes: 17, readers: 7300, owned: 4800 } },
  { id: '6', title: 'Attack on Titan', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx53390-1RsuABC34P9k.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.1, _count: { volumes: 34, readers: 13600, owned: 10200 } },
  { id: '7', title: 'Naruto', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx11977-yGMaFChZpEyE.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.5, _count: { volumes: 72, readers: 15200, owned: 11400 } },
  { id: '8', title: 'Vinland Saga', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx23007-7D1lNyFIEaCM.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.3, _count: { volumes: 28, readers: 6800, owned: 5100 } },
  { id: '9', title: 'Blue Period', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx116339-qWYzfLwnVLQ8.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.9, _count: { volumes: 15, readers: 4300, owned: 3100 } },
  { id: '10', title: 'Spy x Family', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119090-bfcJMT6DXBYb.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.7, _count: { volumes: 14, readers: 8200, owned: 6400 } },
]

export default function DiscoverPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('newest')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('series')
        .select('*, publisher:publishers!original_publisher_id(id,name,country)')
        .eq('ingest_status', 'published')
        .limit(40)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (sort === 'alpha') query = query.order('title', { ascending: true })
      else query = query.order('created_at', { ascending: false })

      const { data } = await query
      setSeries(data?.length ? (data as Series[]) : MOCK_SERIES)
      setLoading(false)
    }
    load()
  }, [sort, statusFilter])

  const topSeries = series.slice(0, 3)
  const restSeries = series.slice(3)

  return (
    <>
      {/* Page header */}
      <div className="section-header" style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
            <TrendingUp size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
            Discover
          </h1>
          <p>Browse the full manga catalog — sorted and filtered your way.</p>
        </div>
      </div>

      {/* Filters */}
      <div id="discover-filters" className="card animate-fade-in" style={{ padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-8)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['all', 'ongoing', 'completed', 'hiatus'] as StatusFilter[]).map(s => (
            <button
              key={s}
              id={`filter-status-${s}`}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sort:</span>
          <select
            id="discover-sort-select"
            className="input select"
            style={{ width: 'auto', padding: '6px 36px 6px 12px' }}
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
          >
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Featured top 3 */}
      {!loading && topSeries.length > 0 && (
        <section id="featured-section" style={{ marginBottom: 'var(--space-10)' }}>
          <div className="section-header"><h2>🔥 Top Picks</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
            {topSeries.map((s, i) => (
              <Link key={s.id} to={`/series/${s.id}`} id={`featured-series-${s.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card-hover animate-fade-up" style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-4)', animationDelay: `${i * 100}ms` }}>
                  <div style={{ width: 80, height: 120, borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface)' }}>
                    {s.cover_url && <img src={s.cover_url} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" referrerPolicy="no-referrer" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="badge badge-vermillion" style={{ marginBottom: 8 }}>#{i + 1} Trending</div>
                    <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{s.title}</h3>
                    <p style={{ fontSize: '0.8125rem', marginBottom: 8 }}>{s._count?.volumes} volumes</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`badge ${s.status === 'ongoing' ? 'badge-slate' : 'badge-ink-green'}`}>{s.status}</span>
                      {s.avg_rating && <span className="badge badge-ochre">★ {s.avg_rating.toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full grid */}
      <section id="all-series-section">
        <div className="section-header">
          <h2>
            <BookOpen size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--ink-green)' }} />
            All Series
          </h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{series.length} series</span>
        </div>
        <div className="grid-covers-lg" id="series-grid">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
            : restSeries.map(s => <SeriesCard key={s.id} series={s} />)
          }
        </div>

        {!loading && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}>
            <Link to="/publishers" className="btn btn-secondary" id="view-by-publisher-btn">
              Browse by publisher <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
