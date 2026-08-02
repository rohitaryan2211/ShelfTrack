import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, BookMarked, Star, Library } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { VolumeCard } from '../../components/Cards'
import ActivityFeed from '../../components/ActivityFeed'
import type { Profile, LibraryEntry, Review, Volume } from '../../lib/types'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [shelfVolumes, setShelfVolumes] = useState<Volume[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const target = username ?? (user?.email?.split('@')[0])
      if (!target) return

      const [profResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('username', target).maybeSingle(),
      ])
      const prof = profResult.data as Profile | null
      setProfile(prof)
      
      // Always refresh profile for logged-in user to get latest data
      if (!username && user) {
        const { data: userProf } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (userProf) setProfile(userProf as Profile)
      }

      if (prof) {
        const [entriesResult, reviewsResult] = await Promise.all([
          supabase
            .from('library_entries')
            .select(`
              *,
              volume:volumes(
                id, series_id, volume_number, title, isbn13, publisher_id, region_code,
                release_date, cover_url, page_count,
                series:series(id, title, original_title, type, genre, status, cover_url, description,
                  publisher:publishers!original_publisher_id(id, name, country)
                ),
                publisher:publishers(id, name, country)
              ),
              series:series(id, title, cover_url)
            `)
            .eq('user_id', prof.id)
            .eq('owned', true)
            .limit(60),
          supabase
            .from('reviews')
            .select('*, series:series(id,title,cover_url)')
            .eq('user_id', prof.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const entries = (entriesResult.data ?? []) as LibraryEntry[]
        const vols: Volume[] = entries
          .filter(e => e.volume)
          .map(e => e.volume!)

        setShelfVolumes(vols)
        setReviews((reviewsResult.data ?? []) as Review[])
      }
      setLoading(false)
    }
    load()
  }, [username, user])

  const isOwn = user && (!username || username === user.email?.split('@')[0])
  const displayName = profile?.username ?? username ?? user?.email?.split('@')[0] ?? 'User'
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'

  return (
    <>
      {/* Profile header */}
      <div className="animate-fade-in" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', marginBottom: 'var(--space-10)', flexWrap: 'wrap' }}>
        <div className="avatar avatar-2xl">{displayName[0]?.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>@{displayName}</h1>
          {profile?.bio && <p style={{ marginBottom: 'var(--space-4)', maxWidth: 480 }}>{profile.bio}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Calendar size={14} /> Joined {joinDate}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <BookMarked size={14} /> {shelfVolumes.length} owned
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Star size={14} /> {reviews.length} reviews
            </span>
          </div>
        </div>
        {isOwn && (
          <Link to="/settings" className="btn btn-secondary btn-sm" id="edit-profile-btn">Edit Profile</Link>
        )}
      </div>

      {/* Collection (owned volumes) */}
      <section id="profile-shelf-section" style={{ marginBottom: 'var(--space-10)' }}>
        <div className="section-header">
          <h2><BookMarked size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Collection</h2>
          {isOwn && <Link to="/library?tab=owned" className="btn btn-ghost btn-sm" id="profile-view-all-shelf-btn">View all</Link>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto' }}>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ width: 140, height: 210, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />)}
          </div>
        ) : shelfVolumes.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><BookMarked size={28} /></div>
            <p>{isOwn ? 'Your collection is empty — start adding volumes!' : `${displayName} hasn't added anything to their collection yet.`}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
            {shelfVolumes.map(vol => (
              <div key={vol.id} style={{ width: 140, flexShrink: 0 }}>
                <VolumeCard volume={vol} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* User Activity Feed */}
      {profile?.id && (
        <section id="profile-activity-section" style={{ marginBottom: 'var(--space-10)' }}>
          <div className="section-header">
            <h2><BookMarked size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--vermillion)' }} />Recent Activity</h2>
          </div>
          <ActivityFeed userId={profile.id} limit={5} />
        </section>
      )}

      {/* Reviews */}
      <section id="profile-reviews-section">
        <div className="section-header">
          <h2><Star size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--ochre)' }} />Reviews</h2>
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><Star size={28} /></div>
            <p>No reviews yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {reviews.map(r => (
              <div key={r.id} className="card animate-fade-up" style={{ padding: 'var(--space-5)' }} id={`profile-review-${r.id}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                  {r.series?.cover_url && (
                    <div style={{ width: 40, height: 56, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={r.series.cover_url} alt={r.series.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={r.series_id ? `/series/${r.series_id}` : '#'} style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{r.series?.title}</Link>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                  {r.rating && <span style={{ color: 'var(--ochre)', fontWeight: 700 }}>★ {r.rating}/10</span>}
                  {r.contains_spoilers && <span className="badge badge-ochre">Spoilers</span>}
                </div>
                <p style={{ lineHeight: 1.75, fontSize: '0.9375rem' }}>{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {!loading && !profile && (
        <div className="empty-state animate-fade-up" style={{ paddingTop: 'var(--space-16)' }}>
          <div className="empty-state-icon" style={{ width: 80, height: 80 }}><Library size={36} /></div>
          <h3>Profile not found</h3>
          <p>@{displayName} hasn't set up their profile yet.</p>
        </div>
      )}
    </>
  )
}
