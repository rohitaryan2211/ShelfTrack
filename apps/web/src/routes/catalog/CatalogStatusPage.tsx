import { Fragment, useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Database, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { SeriesCard, SkeletonCard } from '../../components/Cards'
import type { Series, SyncRun } from '../../lib/types'

const SOURCES = [
  { name: 'AniList', url: 'https://anilist.co', use: 'Series list, titles, synopsis, authors, status, popularity, covers' },
  { name: 'MangaDex', url: 'https://mangadex.org', use: 'Per-volume covers, demographic, chapter → volume mapping' },
  { name: 'MangaUpdates', url: 'https://www.mangaupdates.com', use: 'Original publishers, English licensors and volume counts' },
]

const STATUS_META: Record<SyncRun['status'], { label: string; className: string; icon: React.ReactNode }> = {
  success: { label: 'Success', className: 'badge-ink-green', icon: <CheckCircle2 size={12} /> },
  partial: { label: 'Partial', className: 'badge-ochre', icon: <AlertTriangle size={12} /> },
  failed: { label: 'Failed', className: 'badge-vermillion', icon: <XCircle size={12} /> },
  running: { label: 'Running', className: 'badge-slate', icon: <RefreshCw size={12} /> },
}

/** The workflow runs Mondays 09:00 UTC. */
function nextScheduledRun(now = new Date()): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0))
  const daysUntilMonday = (8 - next.getUTCDay()) % 7
  next.setUTCDate(next.getUTCDate() + daysUntilMonday)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7)
  return next
}

function formatDuration(run: SyncRun): string {
  if (!run.finished_at) return '—'
  const mins = (Date.parse(run.finished_at) - Date.parse(run.started_at)) / 60_000
  return mins < 1 ? '<1 min' : `${Math.round(mins)} min`
}

async function count(table: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count ?? 0
}

export default function CatalogStatusPage() {
  const [runs, setRuns] = useState<SyncRun[] | null>(null)
  const [recent, setRecent] = useState<Series[] | null>(null)
  const [totals, setTotals] = useState<{ series: number; volumes: number; chapters: number; publishers: number } | null>(null)
  const [openRun, setOpenRun] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(12),
      supabase.from('series').select('*').eq('ingest_status', 'published').order('created_at', { ascending: false }).limit(12),
      Promise.all(['series', 'volumes', 'chapters', 'publishers'].map(count)),
    ]).then(([runsRes, recentRes, [series, volumes, chapters, publishers]]) => {
      if (cancelled) return
      setRuns((runsRes.data as SyncRun[]) ?? [])
      setRecent((recentRes.data as Series[]) ?? [])
      setTotals({ series, volumes, chapters, publishers })
    })
    return () => { cancelled = true }
  }, [])

  const lastRun = runs?.[0]
  const next = nextScheduledRun()

  return (
    <>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={28} style={{ color: 'var(--vermillion)' }} /> Catalog Status
        </h1>
        <p>The catalog builds and updates itself every week from free public databases. No manual entry required.</p>
      </div>

      {/* Totals */}
      <div className="grid-stats" style={{ marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Series', value: totals?.series },
          { label: 'Volumes', value: totals?.volumes },
          { label: 'Chapters', value: totals?.chapters },
          { label: 'Publishers', value: totals?.publishers },
        ].map(t => (
          <div key={t.label} className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)' }}>
              {t.value == null ? <span className="skeleton" style={{ display: 'inline-block', width: 56, height: 28 }} /> : t.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Schedule */}
      <section className="card" style={{ padding: 'var(--space-5) var(--space-6)', marginBottom: 'var(--space-8)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Clock size={18} style={{ color: 'var(--ochre)' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last sync</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {runs === null ? '…' : lastRun ? new Date(lastRun.started_at).toLocaleString() : 'Not run yet'}
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Next scheduled</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{next.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        </div>
        {lastRun && (
          <span className={`badge ${STATUS_META[lastRun.status].className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {STATUS_META[lastRun.status].icon} {STATUS_META[lastRun.status].label}
          </span>
        )}
      </section>

      {/* Run history */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <div className="section-header"><h2>Sync history</h2></div>
        {runs === null ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
        ) : runs.length === 0 ? (
          <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><RefreshCw size={28} /></div>
            <h3>No sync runs yet</h3>
            <p>The first run happens on the next schedule, or can be started from GitHub Actions → Catalog Sync.</p>
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Started</th><th>Status</th><th>Checked</th><th>Added</th><th>Updated</th><th>New volumes</th><th>New chapters</th><th>Took</th></tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <Fragment key={run.id}>
                    <tr>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(run.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td>
                        <span className={`badge ${STATUS_META[run.status].className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {STATUS_META[run.status].icon} {STATUS_META[run.status].label}
                        </span>
                        {run.errors?.length > 0 && (
                          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => setOpenRun(openRun === run.id ? null : run.id)}>
                            {run.errors.length} issue{run.errors.length === 1 ? '' : 's'}
                          </button>
                        )}
                      </td>
                      <td>{run.series_checked}</td>
                      <td>{run.series_added}</td>
                      <td>{run.series_updated}</td>
                      <td>{run.volumes_added}</td>
                      <td>{run.chapters_added}</td>
                      <td>{formatDuration(run)}</td>
                    </tr>
                    {openRun === run.id && (
                      <tr>
                        <td colSpan={8}>
                          <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {run.errors.map((e, i) => <li key={i}><strong>{e.series}</strong>: {e.error}</li>)}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recently added */}
      <section style={{ marginBottom: 'var(--space-10)' }}>
        <div className="section-header"><h2>Recently added</h2></div>
        <div className="scroll-row">
          {recent === null
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={220} />)
            : recent.map(s => <SeriesCard key={s.id} series={s} />)}
        </div>
      </section>

      {/* Sources */}
      <section>
        <div className="section-header"><h2>Data sources</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {SOURCES.map(src => (
            <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer" className="card card-hover" style={{ padding: 'var(--space-5)', textDecoration: 'none' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {src.name} <ExternalLink size={12} />
              </div>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>{src.use}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
