import { useState, useEffect } from 'react'
import { ShieldCheck, RefreshCw, Check, X, Edit, Database, Plus, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

interface DraftItem {
  id: string
  title: string
  type: 'series' | 'volume'
  ingest_status: 'draft' | 'published' | 'rejected'
  created_at: string
  cover_url?: string
}

export default function AdminIngestPage() {
  useAuth()  // auth context still wraps this (ProtectedRoute handles redirect)
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'queue' | 'add-series' | 'add-volume' | 'availability' | 'logs'>('queue')
  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const loadDrafts = async () => {
    setLoading(true)
    const [seriesRes, volumesRes] = await Promise.all([
      supabase.from('series').select('id, title, ingest_status, created_at, cover_url').eq('ingest_status', 'draft'),
      supabase.from('volumes').select('id, volume_number, series:series(title), ingest_status, created_at, cover_url').eq('ingest_status', 'draft')
    ])

    const draftSeries: DraftItem[] = (seriesRes.data ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      type: 'series',
      ingest_status: s.ingest_status,
      created_at: s.created_at,
      cover_url: s.cover_url
    }))

    const draftVolumes: DraftItem[] = (volumesRes.data ?? []).map((v: any) => ({
      id: v.id,
      title: `${v.series?.title ?? 'Unknown Series'} Vol. ${v.volume_number}`,
      type: 'volume',
      ingest_status: v.ingest_status,
      created_at: v.created_at,
      cover_url: v.cover_url
    }))

    setDrafts([...draftSeries, ...draftVolumes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setLoading(false)
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const handleApprove = async (item: DraftItem) => {
    setProcessing(item.id)
    const table = item.type === 'series' ? 'series' : 'volumes'
    const { error } = await supabase.from(table).update({ ingest_status: 'published' }).eq('id', item.id)
    if (!error) {
      setDrafts(d => d.filter(i => i.id !== item.id))
      showToast(`✓ Published: ${item.title}`)
    } else {
      showToast(`Error: ${error.message}`)
    }
    setProcessing(null)
  }

  const handleReject = async (item: DraftItem) => {
    setProcessing(item.id)
    const table = item.type === 'series' ? 'series' : 'volumes'
    const { error } = await supabase.from(table).update({ ingest_status: 'rejected' }).eq('id', item.id)
    if (!error) {
      setDrafts(d => d.filter(i => i.id !== item.id))
      showToast(`Rejected: ${item.title}`)
    } else {
      showToast(`Error: ${error.message}`)
    }
    setProcessing(null)
  }

  const TABS = [
    { key: 'queue' as const, label: 'Pending Queue', icon: <RefreshCw size={15} />, badge: drafts.length },
    { key: 'add-series' as const, label: 'Add Series', icon: <Plus size={15} /> },
    { key: 'add-volume' as const, label: 'Add Volume', icon: <Plus size={15} /> },
    { key: 'availability' as const, label: 'Availability', icon: <Database size={15} /> },
    { key: 'logs' as const, label: 'Ingest Log', icon: <Database size={15} /> },
  ]

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{ background: 'var(--vermillion-dim)', border: '1px solid var(--vermillion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)' }}>
            <ShieldCheck size={20} style={{ color: 'var(--vermillion)' }} />
          </div>
          <h1 style={{ fontSize: '2rem' }}>Data Ingestion</h1>
          <span className="badge badge-vermillion">Curator Only</span>
        </div>
        <p>Review automated ingest drafts, add catalog entries manually, and manage availability data.</p>
      </div>

      {/* Tabs */}
      <div className="tabs" id="admin-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} id={`admin-tab-${t.key}`} onClick={() => setActiveTab(t.key)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.icon}{t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ background: 'var(--vermillion)', color: '#fff', borderRadius: 'var(--radius-full)', padding: '0 6px', fontSize: '0.6875rem', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{t.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── Pending Queue ──────────────────────────── */}
      {activeTab === 'queue' && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="empty-state animate-fade-up" style={{ padding: 'var(--space-12)' }}>
              <div className="empty-state-icon" style={{ background: 'var(--slate-dim)' }}><Check size={28} style={{ color: 'var(--slate)' }} /></div>
              <h3>Queue is clear!</h3>
              <p>No pending items to review. Great job.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {drafts.map((item, i) => (
                <div key={item.id} className="card animate-fade-up" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', animationDelay: `${i * 60}ms` }} id={`draft-item-${item.id}`}>
                  {item.cover_url && (
                    <div style={{ width: 44, height: 64, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
                      <img src={item.cover_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`badge ${item.type === 'series' ? 'badge-ink-green' : 'badge-slate'}`}>{item.type}</span>
                      <span className="badge badge-ochre">Draft</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon" title="Edit" id={`draft-edit-${item.id}`} onClick={() => showToast('Edit mode coming soon')}>
                      <Edit size={15} />
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--slate-dim)', border: '1px solid rgba(20,184,166,0.35)', color: 'var(--slate)' }}
                      id={`draft-approve-${item.id}`}
                      disabled={processing === item.id}
                      onClick={() => handleApprove(item)}
                      title="Approve & publish"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ color: '#f87171' }}
                      id={`draft-reject-${item.id}`}
                      disabled={processing === item.id}
                      onClick={() => handleReject(item)}
                      title="Reject"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Series ─────────────────────────────── */}
      {activeTab === 'add-series' && (
        <div style={{ marginTop: 'var(--space-6)', maxWidth: 560 }}>
          <div className="card animate-fade-in" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-5)' }}>Add New Series</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" htmlFor="ingest-series-title">Title (English)</label>
                <input id="ingest-series-title" type="text" className="input" placeholder="e.g. Frieren: Beyond Journey's End" />
              </div>
              <div>
                <label className="label" htmlFor="ingest-series-original">Original Title</label>
                <input id="ingest-series-original" type="text" className="input" placeholder="e.g. 葬送のフリーレン" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="label" htmlFor="ingest-series-type">Type</label>
                  <select id="ingest-series-type" className="input select">
                    <option value="manga">Manga</option>
                    <option value="novel">Novel</option>
                    <option value="light_novel">Light Novel</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ingest-series-status">Status</label>
                  <select id="ingest-series-status" className="input select">
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="hiatus">Hiatus</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ingest-series-cover">Cover URL</label>
                <input id="ingest-series-cover" type="url" className="input" placeholder="https://…" />
              </div>
              <div>
                <label className="label" htmlFor="ingest-series-description">Description</label>
                <textarea id="ingest-series-description" className="input" style={{ minHeight: 100, resize: 'vertical' }} placeholder="Series synopsis…" />
              </div>
              <button id="ingest-add-series-btn" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => showToast('Series added as draft!')}>
                <Plus size={15} /> Add as Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Volume ─────────────────────────────── */}
      {activeTab === 'add-volume' && (
        <div style={{ marginTop: 'var(--space-6)', maxWidth: 560 }}>
          <div className="card animate-fade-in" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-5)' }}>Add Volume</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" htmlFor="ingest-vol-series">Series</label>
                <select id="ingest-vol-series" className="input select"><option value="">Select a series…</option></select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="label" htmlFor="ingest-vol-number">Volume Number</label>
                  <input id="ingest-vol-number" type="number" className="input" placeholder="1" min={0.5} step={0.5} />
                </div>
                <div>
                  <label className="label" htmlFor="ingest-vol-isbn">ISBN-13</label>
                  <input id="ingest-vol-isbn" type="text" className="input" placeholder="978-…" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="label" htmlFor="ingest-vol-release">Release Date</label>
                  <input id="ingest-vol-release" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="ingest-vol-region">Region</label>
                  <select id="ingest-vol-region" className="input select">
                    <option value="JP">JP</option><option value="US">US</option><option value="GB">GB</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ingest-vol-chapters">Chapter Range</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input id="ingest-vol-ch-start" type="number" className="input" placeholder="Ch. start" />
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <input id="ingest-vol-ch-end" type="number" className="input" placeholder="Ch. end" />
                </div>
              </div>
              <button id="ingest-add-volume-btn" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => showToast('Volume added as draft!')}>
                <Plus size={15} /> Add as Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Availability Manager ─────────────────────── */}
      {activeTab === 'availability' && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div className="card animate-fade-in" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--ochre-dim)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={16} style={{ color: 'var(--ochre)', flexShrink: 0 }} />
              <p style={{ fontSize: '0.875rem', color: 'var(--ochre)', margin: 0 }}>Availability data is curated manually. Always verify retailer links before publishing.</p>
            </div>
            <h2 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-4)' }}>Add Retailer Link</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="label" htmlFor="avail-volume">Volume</label>
                  <select id="avail-volume" className="input select"><option value="">Select volume…</option></select>
                </div>
                <div>
                  <label className="label" htmlFor="avail-retailer">Retailer</label>
                  <select id="avail-retailer" className="input select"><option value="">Select retailer…</option></select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label className="label" htmlFor="avail-region">Region</label>
                  <select id="avail-region" className="input select">
                    <option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="avail-in-print">In Print?</label>
                  <select id="avail-in-print" className="input select">
                    <option value="true">Yes</option><option value="false">No</option><option value="">Unknown</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="avail-url">Product URL</label>
                <input id="avail-url" type="url" className="input" placeholder="https://…" />
              </div>
              <button id="avail-save-btn" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => showToast('Availability entry saved!')}>
                <Plus size={15} /> Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ingest Logs ─────────────────────────────── */}
      {activeTab === 'logs' && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div className="card empty-state" style={{ padding: 'var(--space-8)' }}>
            <div className="empty-state-icon"><Database size={28} /></div>
            <h3>No ingest logs available</h3>
            <p>Ingestion script output is printed to the shell/terminal logs during ingestion execution.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span style={{ color: 'var(--slate)', fontSize: '1.25rem' }}>✓</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </>
  )
}
