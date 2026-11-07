import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search, BookOpen, BookMarked, User } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Series, Publisher } from '../../lib/types'

type ResultType = 'series' | 'publishers'

interface SearchResult {
  type: ResultType
  id: string
  title: string
  subtitle?: string
  cover_url?: string
  badge?: string
}

function mapSeries(s: Series): SearchResult {
  const subtitle = [s.author, s.original_title !== s.title ? s.original_title : null].filter(Boolean).join(' · ')
  return { type: 'series', id: s.id, title: s.title, subtitle: subtitle || undefined, cover_url: s.cover_url, badge: s.status }
}

function mapPublisher(p: Publisher): SearchResult {
  return { type: 'publishers', id: p.id, title: p.name, subtitle: p.country, badge: p.is_original_publisher ? 'Original' : 'Licensor' }
}

const TYPE_ICONS: Record<ResultType, React.ReactNode> = {
  series: <BookOpen size={16} />,
  publishers: <User size={16} />,
}

const RESULT_LINK: Record<ResultType, (id: string) => string> = {
  series: id => `/series/${id}`,
  publishers: id => `/publishers/${id}`,
}

const sanitize = (q: string) => q.replace(/[,()*%\\]/g, ' ').trim()

async function runSearch(raw: string): Promise<SearchResult[]> {
  const q = sanitize(raw)
  if (!q) return []
  const like = `%${q}%`
  const [seriesResult, pubResult] = await Promise.all([
    supabase
      .from('series')
      .select('id,title,original_title,author,status,cover_url')
      .or(`title.ilike.${like},original_title.ilike.${like},author.ilike.${like}`)
      .eq('ingest_status', 'published')
      .order('popularity', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase.from('publishers').select('*').ilike('name', like).limit(5),
  ])
  return [
    ...((seriesResult.data ?? []) as Series[]).map(mapSeries),
    ...((pubResult.data ?? []) as Publisher[]).map(mapPublisher),
  ]
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  // Keep the input in sync when the URL changes from elsewhere (e.g. the topbar search)
  const [query, setQuery] = useState(urlQuery)
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setQuery(urlQuery)
  }

  const [fetched, setFetched] = useState<{ q: string; results: SearchResult[] }>({ q: '', results: [] })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!urlQuery.trim()) return
    let cancelled = false
    runSearch(urlQuery).then(results => { if (!cancelled) setFetched({ q: urlQuery, results }) })
    return () => { cancelled = true }
  }, [urlQuery])

  const hasQuery = urlQuery.trim() !== ''
  const loading = hasQuery && fetched.q !== urlQuery
  const results = hasQuery ? fetched.results : []

  const handleInput = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchParams(q ? { q } : {}, { replace: true })
    }, 350)
  }

  const grouped = results.reduce<Record<ResultType, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<ResultType, SearchResult[]>)

  return (
    <>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-5)' }}>
          <Search size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
          Search
        </h1>

        <div className="input-group" style={{ maxWidth: 600 }}>
          <Search size={18} className="input-icon" />
          <input
            id="search-input"
            type="search"
            className="input"
            placeholder="Search series, authors, publishers…"
            value={query}
            onChange={e => handleInput(e.target.value)}
            autoFocus
            style={{ height: 52, fontSize: '1rem' }}
          />
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      )}

      {!loading && hasQuery && results.length === 0 && (
        <div className="empty-state animate-fade-up">
          <div className="empty-state-icon"><Search size={28} /></div>
          <h3>No results for "{urlQuery}"</h3>
          <p>Try a different spelling or browse the <Link to="/discover" style={{ color: 'var(--vermillion)' }}>full catalog</Link>.</p>
        </div>
      )}

      {!hasQuery && (
        <div className="empty-state animate-fade-up" style={{ paddingTop: 'var(--space-10)' }}>
          <div className="empty-state-icon"><Search size={32} /></div>
          <h3>Start typing to search</h3>
          <p>Search across series titles (English and Japanese), authors and publishers.</p>
        </div>
      )}

      {!loading && Object.entries(grouped).map(([type, items]) => (
        <section key={type} id={`search-section-${type}`} style={{ marginBottom: 'var(--space-8)' }}>
          <div className="section-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.125rem' }}>
              {TYPE_ICONS[type as ResultType]}
              {type === 'series' ? 'Series' : type === 'publishers' ? 'Publishers' : 'Volumes'}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {items.map((r, i) => (
              <Link
                key={r.id}
                to={RESULT_LINK[r.type](r.id)}
                className="card card-hover animate-fade-up"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textDecoration: 'none', animationDelay: `${i * 50}ms` }}
                id={`search-result-${r.type}-${r.id}`}
              >
                {/* Thumbnail */}
                <div style={{ width: 48, height: 68, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-surface)' }}>
                  {r.cover_url
                    ? <img src={r.cover_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" referrerPolicy="no-referrer" />
                    : <div className="cover-placeholder">{r.type === 'series' ? <BookMarked size={18} /> : <User size={18} />}</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: 4 }}>{r.title}</div>
                  {r.subtitle && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{r.subtitle}</div>}
                </div>
                {r.badge && <span className="badge badge-neutral">{r.badge}</span>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
