import { Link } from 'react-router-dom'
import { BookMarked, Eye, Star } from 'lucide-react'
import type { Series, Volume } from '../lib/types'

// ─── Series Card (covers grid) ─────────────────────────────
interface SeriesCardProps {
  series: Series
  size?: 'sm' | 'md'
}

export function SeriesCard({ series, size = 'md' }: SeriesCardProps) {
  const width = size === 'sm' ? 130 : 170

  return (
    <Link to={`/series/${series.id}`} className="volume-card animate-fade-up" style={{ width, flexShrink: 0 }} id={`series-card-${series.id}`}>
      <div className="volume-card-cover">
        {series.cover_url ? (
          <img src={series.cover_url} alt={series.title} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="cover-placeholder">
            <BookMarked size={32} />
          </div>
        )}
        <div className="volume-card-cover-overlay" />
        <div className="volume-card-actions">
          <span className={`badge ${series.status === 'ongoing' ? 'badge-slate' : series.status === 'completed' ? 'badge-ink-green' : 'badge-ochre'}`}>
            {series.status}
          </span>
        </div>
      </div>
      <div className="volume-card-body">
        <div className="volume-card-title" title={series.title}>{series.title}</div>
        <div className="volume-card-meta">
          {series.avg_rating && (
            <>
              <Star size={11} fill="currentColor" style={{ color: 'var(--ochre)' }} />
              <span style={{ color: 'var(--ochre)' }}>{series.avg_rating.toFixed(1)}</span>
              <span>·</span>
            </>
          )}
          {series._count?.volumes != null && <span>{series._count.volumes} vols</span>}
        </div>
      </div>
    </Link>
  )
}

// ─── Volume Card ──────────────────────────────────────────
interface VolumeCardProps {
  volume: Volume
  readStatus?: string
  owned?: boolean
  onToggleOwned?: () => void
  onToggleRead?: () => void
}

export function VolumeCard({ volume, readStatus, owned, onToggleOwned, onToggleRead }: VolumeCardProps) {
  return (
    <div className="volume-card animate-fade-up" id={`volume-card-${volume.id}`}>
      <div className="volume-card-cover">
        {volume.cover_url ? (
          <img src={volume.cover_url} alt={`Vol. ${volume.volume_number}`} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="cover-placeholder">
            <BookMarked size={24} />
          </div>
        )}
        <div className="volume-card-cover-overlay" />
        <div className="volume-card-actions">
          {onToggleRead && (
            <button
              className={`btn btn-sm ${readStatus === 'completed' ? 'active-read' : 'btn-secondary'}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleRead() }}
              title={readStatus === 'completed' ? 'Mark unread' : 'Mark as read'}
              id={`toggle-read-${volume.id}`}
            >
              <Eye size={12} />
            </button>
          )}
          {onToggleOwned && (
            <button
              className={`btn btn-sm ${owned ? 'active-owned' : 'btn-secondary'}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleOwned() }}
              title={owned ? 'Remove from shelf' : 'Add to shelf'}
              id={`toggle-owned-${volume.id}`}
            >
              <BookMarked size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="volume-card-body">
        <div className="volume-card-title">Vol. {volume.volume_number}{volume.title ? ` — ${volume.title}` : ''}</div>
        <div className="volume-card-meta">
          {volume.release_date && <span>{new Date(volume.release_date).getFullYear()}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton card ────────────────────────────────────────
export function SkeletonCard({ height = 260 }: { height?: number }) {
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div className="skeleton" style={{ height, width: '100%' }} />
      <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 14, width: '80%' }} />
        <div className="skeleton" style={{ height: 12, width: '50%' }} />
      </div>
    </div>
  )
}
