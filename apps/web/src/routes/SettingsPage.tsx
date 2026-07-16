import { useEffect, useState } from 'react'
import { Settings, User, Globe, Shield, Trash2, Save } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

const REGIONS = [
  { code: 'US', name: '🇺🇸 United States' },
  { code: 'GB', name: '🇬🇧 United Kingdom' },
  { code: 'IN', name: '🇮🇳 India' },
  { code: 'AU', name: '🇦🇺 Australia' },
  { code: 'JP', name: '🇯🇵 Japan' },
  { code: 'DE', name: '🇩🇪 Germany' },
  { code: 'FR', name: '🇫🇷 France' },
]

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [region, setRegion] = useState('US')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setUsername(data.username ?? '')
        setBio(data.bio ?? '')
      }
    })
  }, [user])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, username, bio, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) showToast(`Error: ${error.message}`)
    else showToast('Profile saved!')
    setSaving(false)
  }

  return (
    <>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
          <Settings size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
          Settings
        </h1>
        <p>Manage your profile, preferences, and account.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 640 }}>
        {/* Profile section */}
        <section id="settings-profile-section" className="card animate-fade-up" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-5)' }}>
            <User size={18} style={{ color: 'var(--ink-green)' }} /> Profile
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Avatar preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <div className="avatar avatar-xl">{(username || user?.email || 'U')[0].toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{username || 'Your Username'}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="settings-username">Username</label>
              <input id="settings-username" type="text" className="input" placeholder="your_username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="settings-bio">Bio</label>
              <textarea id="settings-bio" className="input" placeholder="Tell the community about yourself…" value={bio} onChange={e => setBio(e.target.value)} style={{ minHeight: 90, resize: 'vertical' }} />
            </div>
          </div>
        </section>

        {/* Preferences section */}
        <section id="settings-prefs-section" className="card animate-fade-up delay-100" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-5)' }}>
            <Globe size={18} style={{ color: 'var(--slate)' }} /> Preferences
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label className="label" htmlFor="settings-region">Default Region</label>
              <p style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-2)' }}>Used to filter availability tables on volume pages.</p>
              <select id="settings-region" className="input select" value={region} onChange={e => setRegion(e.target.value)}>
                {REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="settings-privacy">Profile Visibility</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button id="settings-public-btn" className={`btn btn-sm ${isPublic ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsPublic(true)}>Public</button>
                <button id="settings-private-btn" className={`btn btn-sm ${!isPublic ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setIsPublic(false)}>Private</button>
              </div>
              <p style={{ fontSize: '0.8125rem', marginTop: 'var(--space-2)', color: 'var(--text-muted)' }}>
                {isPublic ? 'Others can see your shelf and reviews.' : 'Your shelf and reviews are only visible to you.'}
              </p>
            </div>
          </div>
        </section>

        {/* Save button */}
        <button id="settings-save-btn" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {/* Account / Danger zone */}
        <section id="settings-danger-section" className="card animate-fade-up delay-200" style={{ padding: 'var(--space-6)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-5)', color: '#f87171' }}>
            <Shield size={18} /> Account
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button id="settings-signout-btn" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={signOut}>
              Sign out
            </button>
            <button id="settings-delete-btn" className="btn btn-secondary" style={{ alignSelf: 'flex-start', borderColor: 'rgba(239,68,68,0.35)', color: '#f87171' }} onClick={() => alert('Account deletion — contact support.')}>
              <Trash2 size={15} /> Delete account
            </button>
          </div>
        </section>
      </div>

      {toast && (
        <div className="toast" role="status">
          <span style={{ color: 'var(--slate)', fontSize: '1.25rem' }}>✓</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{toast}</span>
        </div>
      )}
    </>
  )
}
