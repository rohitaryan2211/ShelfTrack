import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, User, Shield, Trash2, Save, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

export default function SettingsPage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  // Keyed on the profile so the form re-seeds once the profile finishes loading.
  return (
    <SettingsForm
      key={profile?.id ?? 'loading'}
      initialUsername={profile?.username ?? ''}
      initialBio={profile?.bio ?? ''}
      email={user?.email ?? ''}
      userId={user?.id ?? ''}
      onSaved={refreshProfile}
      onSignOut={async () => { await signOut(); navigate('/') }}
    />
  )
}

interface SettingsFormProps {
  initialUsername: string
  initialBio: string
  email: string
  userId: string
  onSaved: () => Promise<void>
  onSignOut: () => Promise<void>
}

function SettingsForm({ initialUsername, initialBio, email, userId, onSaved, onSignOut }: SettingsFormProps) {
  const [username, setUsername] = useState(initialUsername)
  const [bio, setBio] = useState(initialBio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const normalized = username.trim().toLowerCase()
  // Older usernames (derived from emails) may not match the pattern; allow keeping them unchanged.
  const usernameValid = USERNAME_PATTERN.test(normalized) || normalized === initialUsername
  const dirty = normalized !== initialUsername || bio.trim() !== initialBio

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !usernameValid) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('profiles').update({ username: normalized, bio: bio.trim() || null }).eq('id', userId)
    setSaving(false)
    if (error) {
      setError(error.code === '23505' ? `@${normalized} is already taken.` : error.message)
      return
    }
    await onSaved()
    showToast('Profile saved')
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      setDeleting(false)
      setError(`Could not delete account: ${error.message}`)
      return
    }
    await onSignOut()
  }

  return (
    <>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
          <Settings size={28} style={{ display: 'inline', marginRight: 10, color: 'var(--vermillion)' }} />
          Settings
        </h1>
        <p>Manage your profile and account.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 640 }}>
        <form id="settings-profile-section" className="card animate-fade-up" style={{ padding: 'var(--space-6)' }} onSubmit={handleSave}>
          <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-5)' }}>
            <User size={18} style={{ color: 'var(--ink-green)' }} /> Profile
          </h2>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <div className="avatar avatar-xl">{(normalized || email || 'U')[0].toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{normalized || 'username'}</div>
                <div className="truncate" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{email}</div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="settings-username">Username</label>
              <input
                id="settings-username"
                type="text"
                className="input"
                placeholder="your_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                aria-invalid={!usernameValid}
              />
              <p style={{ fontSize: '0.75rem', marginTop: 6, color: usernameValid ? 'var(--text-muted)' : '#f87171' }}>
                3–30 characters: lowercase letters, numbers and underscores.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="settings-bio">Bio</label>
              <textarea id="settings-bio" className="input" placeholder="Tell the community about yourself…" value={bio} onChange={e => setBio(e.target.value)} maxLength={500} style={{ minHeight: 90, resize: 'vertical' }} />
            </div>

            <button id="settings-save-btn" type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving || !dirty || !usernameValid}>
              <Save size={16} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <section id="settings-danger-section" className="card animate-fade-up delay-100" style={{ padding: 'var(--space-6)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <h2 style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-5)' }}>
            <Shield size={18} style={{ color: '#f87171' }} /> Account
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <button id="settings-signout-btn" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onSignOut}>
              <LogOut size={15} /> Sign out
            </button>

            <div>
              <label className="label" htmlFor="settings-delete-confirm">Delete account</label>
              <p style={{ fontSize: '0.8125rem', marginBottom: 'var(--space-3)' }}>
                Permanently deletes your profile, shelf, reading log and reviews. Type <strong>delete</strong> to confirm.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <input id="settings-delete-confirm" className="input" style={{ maxWidth: 200 }} value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} placeholder="delete" />
                <button
                  id="settings-delete-btn"
                  className="btn btn-secondary"
                  style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#f87171' }}
                  disabled={confirmDelete.trim().toLowerCase() !== 'delete' || deleting}
                  onClick={handleDelete}
                >
                  <Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
              </div>
            </div>
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
