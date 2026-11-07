import { Link } from 'react-router-dom'
import { ArrowRight, BookMarked, Eye, TrendingUp, Users, Globe, Building2, Library } from 'lucide-react'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useState } from 'react'
import type { Series } from '../lib/types'
import ActivityFeed from '../components/ActivityFeed'

// ── Feature highlight data (static UI copy) ────
const FEATURES = [
  {
    icon: <Eye size={28} style={{ color: 'var(--ink-green)' }} />,
    title: 'Track what you read',
    desc: 'Reading, completed, on hold, dropped — plus chapter-by-chapter checkmarks and your own 10-point rating.',
    bg: 'var(--ink-green-dim)',
    border: 'var(--ink-green-border)',
  },
  {
    icon: <BookMarked size={28} style={{ color: 'var(--vermillion)' }} />,
    title: 'Own what you love',
    desc: 'Your shelf is separate from your reading log. Mark the exact volumes you own, and wishlist the ones you want.',
    bg: 'var(--vermillion-dim)',
    border: 'var(--vermillion-border)',
  },
  {
    icon: <Globe size={28} style={{ color: 'var(--ochre)' }} />,
    title: 'Every edition, every volume',
    desc: 'Japanese originals and English editions, volume by volume, with covers — kept up to date automatically every week.',
    bg: 'var(--ochre-dim)',
    border: 'rgba(201,154,60,0.35)',
  },
]

interface CatalogCounts { series: number; volumes: number; publishers: number; readers: number }

async function countRows(table: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count ?? 0
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Page ─────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth()
  const [trending, setTrending] = useState<Series[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [counts, setCounts] = useState<CatalogCounts | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('series')
        .select('*, publisher:publishers!original_publisher_id(id,name,country)')
        .eq('ingest_status', 'published')
        .order('popularity', { ascending: false, nullsFirst: false })
        .limit(16)
      setTrending((data as Series[]) ?? [])
      setLoadingTrending(false)
    }
    async function loadCounts() {
      const [series, volumes, publishers, readers] = await Promise.all(
        ['series', 'volumes', 'publishers', 'profiles'].map(countRows),
      )
      setCounts({ series, volumes, publishers, readers })
    }
    load()
    loadCounts()
  }, [])

  const stats = [
    { icon: <Library size={20} />,   value: counts?.series,     label: 'Series' },
    { icon: <BookMarked size={20} />, value: counts?.volumes,    label: 'Volumes cataloged' },
    { icon: <Building2 size={20} />, value: counts?.publishers, label: 'Publishers' },
    { icon: <Users size={20} />,     value: counts?.readers,    label: 'Readers' },
  ]

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hero-section animate-fade-in" id="hero-section" style={{ marginBottom: 'var(--space-12)' }}>
        <div className="hero-bg-glow" />
        <div className="hero-grid-dots" />
        <div style={{ position: 'relative', zIndex: 1, padding: 'var(--space-12) var(--space-10)', maxWidth: 640 }}>
          <div className="badge badge-vermillion animate-fade-up" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
            🎌 Manga tracking, reimagined
          </div>
          <h1 className="animate-fade-up delay-100" style={{ marginBottom: 'var(--space-5)', lineHeight: 1.1 }}>
            Track what you{' '}
            <span className="text-gradient">read</span>.{' '}
            Own what you{' '}
            <span className="text-gradient">love</span>.
          </h1>
          <p className="animate-fade-up delay-200" style={{ fontSize: '1.125rem', marginBottom: 'var(--space-8)', color: 'var(--text-secondary)', maxWidth: 480 }}>
            ShelfTrack is the manga tracker that finally separates <strong>reading</strong> from <strong>owning</strong> — every series, every volume, every edition.
          </p>
          <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {user ? (
              <Link to="/library" className="btn btn-primary btn-lg" id="hero-library-btn">
                My Library <ArrowRight size={18} />
              </Link>
            ) : (
              <Link to="/login" className="btn btn-primary btn-lg" id="hero-signup-btn">
                Start your shelf <ArrowRight size={18} />
              </Link>
            )}
            <Link to="/discover" className="btn btn-secondary btn-lg" id="hero-discover-btn">
              Browse catalog
            </Link>
          </div>
        </div>

        {/* Fan spread of trending covers */}
        <div style={{
          position: 'absolute', right: '10%', top: '50%', transform: 'translateY(-50%)',
          width: 400, height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }} aria-hidden="true" className="hero-fan-spread hidden-on-mobile">
          {trending.slice(0, 5).map((s, i) => {
            if (!s.cover_url) return null
            const offset = i - 2
            const rotation = offset * 12
            const translateX = offset * 60
            const translateY = Math.abs(offset) * 20
            const zIndex = 10 - Math.abs(offset)
            const scale = 1 - (Math.abs(offset) * 0.05)
            
            return (
              <div key={s.id} className="animate-fade-up" style={{
                position: 'absolute',
                width: 240,
                aspectRatio: '2/3',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
                transform: `translateX(${translateX}px) translateY(${translateY}px) rotateZ(${rotation}deg) scale(${scale})`,
                zIndex,
                animationDelay: `${300 + i * 100}ms`,
                opacity: 0.95,
              }}>
                <img 
                  src={s.cover_url} 
                  alt="" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  referrerPolicy="no-referrer" 
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,0,0,0.4) 100%)',
                }} />
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Stats banner ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
        {stats.map((s, i) => (
          <div key={i} className="card animate-fade-up" style={{ padding: 'var(--space-5)', textAlign: 'center', animationDelay: `${i * 80}ms` }}>
            <div style={{ color: 'var(--vermillion)', marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {s.value == null ? <span className="skeleton" style={{ display: 'inline-block', width: 48, height: 24 }} /> : formatCount(s.value)}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Feature highlights ────────────────────────────── */}
      <section id="features-section" style={{ marginBottom: 'var(--space-12)' }}>
        <div className="section-header">
          <h2>Why ShelfTrack?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="card animate-fade-up"
              style={{ padding: 'var(--space-6)', animationDelay: `${i * 100}ms`, borderColor: f.border }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-lg)', background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
                {f.icon}
              </div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>{f.title}</h3>
              <p style={{ fontSize: '0.9375rem' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trending now ─────────────────────────────────── */}
      <section id="trending-section" style={{ marginBottom: 'var(--space-12)' }}>
        <div className="section-header">
          <h2><TrendingUp size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Popular Now</h2>
          <Link to="/discover" className="btn btn-ghost btn-sm" id="view-all-trending-btn">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="scroll-row" id="trending-scroll-row">
          {loadingTrending
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={220} />)
            : trending.length > 0
              ? trending.map(s => <SeriesCard key={s.id} series={s} />)
              : (
                <div className="empty-state" style={{ width: '100%', padding: 'var(--space-8)' }}>
                  <div className="empty-state-icon"><TrendingUp size={28} /></div>
                  <p>The catalog is filling up — check back after the next sync.</p>
                </div>
              )
          }
        </div>
      </section>

      {/* ── Community Activity Feed ────────────────────── */}
      <section id="community-activity-section" style={{ marginBottom: 'var(--space-12)' }}>
        <div className="section-header">
          <h2><Users size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Community Activity</h2>
        </div>
        <ActivityFeed limit={8} />
      </section>

      {/* ── CTA banner ───────────────────────────────────── */}
      {!user && (
        <section id="cta-section" className="animate-fade-up">
          <div style={{
            background: 'var(--vermillion-dim)',
            border: '1px solid var(--vermillion-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-12)',
            textAlign: 'center',
          }}>
            <h2 style={{ marginBottom: 'var(--space-3)' }}>Ready to build your shelf?</h2>
            <p style={{ marginBottom: 'var(--space-8)', fontSize: '1.0625rem' }}>
              Free. No password, no card — just your email.
            </p>
            <Link to="/login" className="btn btn-primary btn-lg" id="cta-signup-btn">
              Create free account <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}
    </>
  )
}
