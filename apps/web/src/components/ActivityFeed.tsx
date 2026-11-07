import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, BookOpen, Star } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import type { ActivityFeedItem } from '../lib/types'

interface ActivityFeedProps {
  userId?: string
  limit?: number
}

export default function ActivityFeed({ userId, limit = 20 }: ActivityFeedProps) {
  const { user } = useAuth()
  const [activities, setActivities] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [likesMap, setLikesMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadActivities() {
      setLoading(true)
      let query = supabase
        .from('activity_feed')
        .select(`
          *,
          user_profile:profiles!activity_feed_user_id_fkey(*),
          series:series(*),
          volume:volumes(*),
          review:reviews(*)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
      if (!error && data) {
        setActivities(data as ActivityFeedItem[])

        if (user && data.length > 0) {
          const activityIds = (data as ActivityFeedItem[]).map(a => a.id)
          const { data: userLikes } = await supabase
            .from('activity_likes')
            .select('activity_id')
            .eq('user_id', user.id)
            .in('activity_id', activityIds)

          if (userLikes) {
            const likedMap: Record<string, boolean> = {}
            userLikes.forEach((l: { activity_id: string }) => { likedMap[l.activity_id] = true })
            setLikesMap(likedMap)
          }
        }
      }
      setLoading(false)
    }

    loadActivities()
  }, [userId, user, limit])

  const toggleLike = async (activityId: string) => {
    if (!user) return
    const isLiked = likesMap[activityId]

    if (isLiked) {
      const { error } = await supabase
        .from('activity_likes')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', user.id)

      if (!error) {
        setLikesMap(prev => ({ ...prev, [activityId]: false }))
        setActivities(prev => prev.map(a => a.id === activityId ? { ...a, likes_count: Math.max(0, (a.likes_count || 1) - 1) } : a))
      }
    } else {
      const { error } = await supabase
        .from('activity_likes')
        .insert({ activity_id: activityId, user_id: user.id })

      if (!error) {
        setLikesMap(prev => ({ ...prev, [activityId]: true }))
        setActivities(prev => prev.map(a => a.id === activityId ? { ...a, likes_count: (a.likes_count || 0) + 1 } : a))
      }
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)' }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div className="skeleton" style={{ height: 16, width: '40%' }} />
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
        <div className="empty-state-icon"><BookOpen size={28} /></div>
        <h3>No recent activity</h3>
        <p>Activity from the community and reading logs will appear here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="activity-feed">
      {activities.map(item => {
        const profile = item.user_profile
        const isLiked = likesMap[item.id]

        return (
          <div key={item.id} className="card animate-fade-up" style={{ padding: 'var(--space-4)', borderLeft: '3px solid var(--vermillion)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              {/* User Avatar */}
              <Link to={`/profile/${profile?.username ?? 'user'}`}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.username} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {profile?.username?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
              </Link>

              {/* Body */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', lineHeight: 1.4, marginBottom: 4 }}>
                  <Link to={`/profile/${profile?.username ?? 'user'}`} style={{ fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
                    @{profile?.username ?? 'Anonymous'}
                  </Link>{' '}

                  {item.event_type === 'completed_volume' && (
                    <span>completed <Link to={`/volumes/${item.volume_id}`} style={{ fontWeight: 600, color: 'var(--vermillion)' }}>Volume {item.volume?.volume_number}</Link> of <Link to={`/series/${item.series_id}`} style={{ color: 'var(--text-primary)' }}>{item.series?.title}</Link></span>
                  )}
                  {item.event_type === 'completed_series' && (
                    <span>completed the entire series <Link to={`/series/${item.series_id}`} style={{ fontWeight: 700, color: 'var(--ink-green)' }}>{item.series?.title}</Link> 🎉</span>
                  )}
                  {item.event_type === 'chapter_logged' && (
                    <span>logged reading chapters in <Link to={`/series/${item.series_id}`} style={{ color: 'var(--text-primary)' }}>{item.series?.title}</Link></span>
                  )}
                  {item.event_type === 'review_published' && (
                    <span>published a review on <Link to={item.series_id ? `/series/${item.series_id}` : `/volumes/${item.volume_id}`} style={{ fontWeight: 600, color: 'var(--ochre)' }}>{item.series?.title ?? `Volume ${item.volume?.volume_number}`}</Link></span>
                  )}
                </div>

                {/* Review Snippet */}
                {item.review?.body && (
                  <div style={{ background: 'var(--bg-card)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', margin: 'var(--space-2) 0', fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2px solid var(--border-subtle)' }}>
                    "{item.review.body}"
                    {item.review.rating && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: 'var(--ochre)', fontStyle: 'normal', fontWeight: 700 }}>
                        <Star size={12} fill="var(--ochre)" /> {item.review.rating}/10
                      </span>
                    )}
                  </div>
                )}

                {/* Action Bar & Timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>

                  <button
                    onClick={() => toggleLike(item.id)}
                    style={{ background: 'none', border: 'none', color: isLiked ? 'var(--vermillion)' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}
                  >
                    <Heart size={14} fill={isLiked ? 'var(--vermillion)' : 'none'} />
                    {item.likes_count || 0}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
