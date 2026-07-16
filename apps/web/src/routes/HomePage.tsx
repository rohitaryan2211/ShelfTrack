import { Link } from 'react-router-dom'
import { ArrowRight, BookMarked, ShoppingBag, Eye, TrendingUp, Star, Users } from 'lucide-react'
import { SeriesCard, SkeletonCard } from '../components/Cards'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabaseClient'
import { useEffect, useState } from 'react'
import type { Series } from '../lib/types'

// ── Mock trending data (used when DB has no data yet) ─────
const MOCK_TRENDING: Series[] = [
  { id: '1', title: 'One Piece', original_title: 'ワンピース', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-oT7YguhDWkKq.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.2, _count: { volumes: 108, readers: 12400, owned: 8900 } },
  { id: '2', title: 'Jujutsu Kaisen', original_title: '呪術廻戦', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113138-G8C1GFrUUB0c.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.8, _count: { volumes: 27, readers: 9800, owned: 6200 } },
  { id: '3', title: 'Demon Slayer', original_title: '鬼滅の刃', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx87216-NfA0GHSb1dxV.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.6, _count: { volumes: 23, readers: 11200, owned: 9400 } },
  { id: '4', title: 'My Hero Academia', original_title: '僕のヒーローアカデミア', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx75989-JBqEHHFIQiQ6.jpg', original_publisher_id: '', created_at: '', avg_rating: 8.1, _count: { volumes: 41, readers: 8700, owned: 6100 } },
  { id: '5', title: 'Chainsaw Man', original_title: 'チェンソーマン', type: 'manga', status: 'ongoing', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113755-NnH1F5Z5BFZJ.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.0, _count: { volumes: 17, readers: 7300, owned: 4800 } },
  { id: '6', title: 'Attack on Titan', original_title: '進撃の巨人', type: 'manga', status: 'completed', cover_url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx53390-1RsuABC34P9k.jpg', original_publisher_id: '', created_at: '', avg_rating: 9.1, _count: { volumes: 34, readers: 13600, owned: 10200 } },
]

// ── Feature highlight data ────────────────────────────────
const FEATURES = [
  {
    icon: <Eye size={28} style={{ color: 'var(--ink-green)' }} />,
    title: 'Track what you read',
    desc: 'Log every volume — scanlation or official, borrowed or bought. Status per volume, not just the series.',
    bg: 'var(--ink-green-dim)',
    border: 'var(--ink-green-border)',
  },
  {
    icon: <BookMarked size={28} style={{ color: 'var(--vermillion)' }} />,
    title: 'Own what you love',
    desc: 'Separate owned shelf from your reading log. Collect physical volumes and digital editions independently.',
    bg: 'var(--vermillion-dim)',
    border: 'var(--vermillion-border)',
  },
  {
    icon: <ShoppingBag size={28} style={{ color: 'var(--slate)' }} />,
    title: 'Know where to buy',
    desc: 'Region-aware retailer links for every volume. Find where to buy vol. 106 in your country right now.',
    bg: 'var(--slate-dim)',
    border: 'rgba(20,184,166,0.35)',
  },
]

const STATS = [
  { icon: <BookMarked size={20} />, value: '10,000+', label: 'Volumes cataloged' },
  { icon: <Users size={20} />,      value: '500+',    label: 'Series tracked' },
  { icon: <Star size={20} />,       value: '4.8★',    label: 'Avg user rating' },
  { icon: <TrendingUp size={20} />, value: '12 pubs', label: 'Publishers supported' },
]

// ── Page ─────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth()
  const [trending, setTrending] = useState<Series[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('series')
        .select('*, publisher:publishers!original_publisher_id(id,name,country)')
        .eq('ingest_status', 'published')
        .order('created_at', { ascending: false })
        .limit(12)
      setTrending(data?.length ? (data as Series[]) : MOCK_TRENDING)
      setLoadingTrending(false)
    }
    load()
  }, [])

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
            ShelfTrack is the manga cataloging platform that finally separates <strong>reading</strong> from <strong>owning</strong> — and tells you exactly where to buy every volume in your region.
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

        {/* Stunning Premium Fan Spread */}
        <div style={{
          position: 'absolute', right: '10%', top: '50%', transform: 'translateY(-50%)',
          width: 400, height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none' // Don't block clicks on buttons underneath if screen shrinks
        }} aria-hidden="true" className="hero-fan-spread hidden-on-mobile">
          {(trending.length > 0 ? trending : MOCK_TRENDING).slice(0, 5).map((s, i) => {
            if (!s.cover_url) return null
            const offset = i - 2 // -2, -1, 0, 1, 2
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
        {STATS.map((s, i) => (
          <div key={i} className="card animate-fade-up" style={{ padding: 'var(--space-5)', textAlign: 'center', animationDelay: `${i * 80}ms` }}>
            <div style={{ color: 'var(--vermillion)', marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
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
          <h2><TrendingUp size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Trending Now</h2>
          <Link to="/discover" className="btn btn-ghost btn-sm" id="view-all-trending-btn">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="scroll-row" id="trending-scroll-row">
          {loadingTrending
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={220} />)
            : trending.map(s => <SeriesCard key={s.id} series={s} />)
          }
        </div>
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
              Free forever. No credit card. Start tracking in 30 seconds.
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
