import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, ExternalLink, BookOpen } from 'lucide-react'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import { supabase } from '../lib/supabaseClient'
import type { Publisher, Series } from '../lib/types'

const MOCK_PUBLISHER: Publisher = { id: '1', name: 'Shueisha', country: 'JP', website: 'https://www.shueisha.co.jp', is_original_publisher: true }
const MOCK_SERIES: Series[] = [
  { id: '1', title: 'One Piece', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg', original_publisher_id: '1', created_at: '', avg_rating: 9.2, _count: { volumes: 108, readers: 12400, owned: 8900 } },
  { id: '2', title: 'Jujutsu Kaisen', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113138-G8C1GFrUUB0c.jpg', original_publisher_id: '1', created_at: '', avg_rating: 8.8, _count: { volumes: 27, readers: 9800, owned: 6200 } },
  { id: '3', title: 'Demon Slayer', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx87216-NfA0GHSb1dxV.jpg', original_publisher_id: '1', created_at: '', avg_rating: 8.6, _count: { volumes: 23, readers: 11200, owned: 9400 } },
  { id: '4', title: 'My Hero Academia', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx75989-JBqEHHFIQiQ6.jpg', original_publisher_id: '1', created_at: '', avg_rating: 8.1, _count: { volumes: 41, readers: 8700, owned: 6100 } },
  { id: '5', title: 'Chainsaw Man', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113755-NnH1F5Z5BFZJ.jpg', original_publisher_id: '1', created_at: '', avg_rating: 9.0, _count: { volumes: 17, readers: 7300, owned: 4800 } },
]
const FLAG: Record<string, string> = { JP: '🇯🇵', US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳' }

export default function PublisherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [publisher, setPublisher] = useState<Publisher | null>(null)
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [pubResult, seriesResult] = await Promise.all([
        supabase.from('publishers').select('*').eq('id', id!).single(),
        supabase.from('series').select('*').eq('original_publisher_id', id!).eq('ingest_status', 'published').limit(40),
      ])
      setPublisher(pubResult.data ?? MOCK_PUBLISHER)
      setSeries(seriesResult.data?.length ? (seriesResult.data as Series[]) : MOCK_SERIES)
      setLoading(false)
    }
    if (id) load()
  }, [id])

  const pub = publisher ?? MOCK_PUBLISHER

  return (
    <>
      <Link to="/publishers" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-publishers-btn">
        <ArrowLeft size={16} /> All Publishers
      </Link>

      {/* Publisher header */}
      <div className="card animate-fade-in" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-8)', display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '2.5rem' }}>{FLAG[pub.country] ?? '🌍'}</span>
            <span className={`badge ${pub.is_original_publisher ? 'badge-vermillion' : 'badge-ink-green'}`}>
              {pub.is_original_publisher ? 'Original Publisher' : 'Regional Licensor'}
            </span>
          </div>
          <h1 style={{ marginBottom: 'var(--space-3)' }}>{pub.name}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Globe size={14} /> {pub.country}
            </span>
            {pub.website && (
              <a href={pub.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" id="publisher-website-link">
                <ExternalLink size={12} /> Website
              </a>
            )}
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '2rem', color: 'var(--vermillion)' }}>{series.length}+</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Series</div>
          </div>
        </div>
      </div>

      {/* Series grid */}
      <section id="publisher-series-section">
        <div className="section-header">
          <h2><BookOpen size={20} style={{ display: 'inline', marginRight: 8 }} />Series by {pub.name}</h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{series.length} titles</span>
        </div>
        <div className="grid-covers-lg" id="publisher-series-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : series.map(s => <SeriesCard key={s.id} series={s} />)
          }
        </div>
      </section>
    </>
  )
}
