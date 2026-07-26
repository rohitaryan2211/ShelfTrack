import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, BookOpen, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import type { Publisher } from '../lib/types'

const FLAG: Record<string, string> = { JP: '🇯🇵', US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳', DE: '🇩🇪', FR: '🇫🇷', AU: '🇦🇺' }

type Filter = 'all' | 'original' | 'licensor'

export default function PublishersPage() {
  const [publishers, setPublishers] = useState<(Publisher & { series_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('publishers').select('*').order('name')
      setPublishers((data as (Publisher & { series_count: number })[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = publishers.filter(p =>
    filter === 'all' ? true :
    filter === 'original' ? p.is_original_publisher :
    !p.is_original_publisher
  )

  return (
    <>
      <div className="section-header" style={{ marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
            <BookOpen size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--ink-green)' }} />
            Publishers
          </h1>
          <p>Browse the catalog by publisher — from Shueisha originals to regional licensors.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tabs" id="publisher-filter-tabs">
        {(['all', 'original', 'licensor'] as Filter[]).map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} id={`filter-pub-${f}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All Publishers' : f === 'original' ? 'JP Originals' : 'Regional Licensors'}
          </button>
        ))}
      </div>

      {/* Publisher grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-6)' }}>
                <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </div>
            ))
          : filtered.length > 0 ? filtered.map((p, i) => (
              <Link
                key={p.id}
                to={`/publishers/${p.id}`}
                id={`publisher-card-${p.id}`}
                className="card card-hover animate-fade-up"
                style={{ padding: 'var(--space-6)', display: 'block', animationDelay: `${i * 50}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: '1.5rem' }}>{FLAG[p.country] ?? '🌍'}</span>
                      <span className={`badge ${p.is_original_publisher ? 'badge-vermillion' : 'badge-ink-green'}`}>
                        {p.is_original_publisher ? 'Original' : 'Licensor'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: 4 }}>{p.name}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {p.country}
                    </p>
                  </div>
                  {p.website && (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="btn btn-ghost btn-icon"
                      title={`Visit ${p.name} website`}
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {p.series_count ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Series</div>
                  </div>
                </div>
              </Link>
            ))
          : (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 'var(--space-10)' }}>
              <div className="empty-state-icon"><BookOpen size={28} /></div>
              <p>No publishers in the catalog yet.</p>
            </div>
          )
        }
      </div>
    </>
  )
}
