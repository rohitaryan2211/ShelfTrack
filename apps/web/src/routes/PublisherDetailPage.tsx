import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Globe, ExternalLink, BookOpen } from 'lucide-react'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import { supabase } from '../lib/supabaseClient'
import type { Publisher, Series } from '../lib/types'

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
      setPublisher(pubResult.data as Publisher | null)
      setSeries((seriesResult.data as Series[]) ?? [])
      setLoading(false)
    }
    if (id) load()
  }, [id])

  if (!loading && !publisher) {
    return (
      <>
        <Link to="/publishers" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-publishers-btn">
          <ArrowLeft size={16} /> All Publishers
        </Link>
        <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
          <div className="empty-state-icon"><BookOpen size={28} /></div>
          <p>Publisher not found.</p>
        </div>
      </>
    )
  }

  const pub = publisher

  return (
    <>
      <Link to="/publishers" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }} id="back-to-publishers-btn">
        <ArrowLeft size={16} /> All Publishers
      </Link>

      {/* Publisher header */}
      {pub && (
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
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '2rem', color: 'var(--vermillion)' }}>{series.length}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Series</div>
            </div>
          </div>
        </div>
      )}

      {/* Series grid */}
      <section id="publisher-series-section">
        <div className="section-header">
          <h2><BookOpen size={20} style={{ display: 'inline', marginRight: 8 }} />Series by {pub?.name ?? '...'}</h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{series.length} titles</span>
        </div>
        <div className="grid-covers-lg" id="publisher-series-grid">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : series.length > 0
              ? series.map(s => <SeriesCard key={s.id} series={s} />)
              : (
                <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 'var(--space-8)' }}>
                  <div className="empty-state-icon"><BookOpen size={28} /></div>
                  <p>No published series from this publisher yet.</p>
                </div>
              )
          }
        </div>
      </section>
    </>
  )
}
