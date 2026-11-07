import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

// Supabase email codes are 6 digits by default (configurable up to 10 in the dashboard).
const CODE_PATTERN = /^\d{6,10}$/
const RESEND_COOLDOWN_S = 60

function cleanAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  if (/expired|invalid/i.test(msg)) return 'That code is invalid or has expired. Request a new one.'
  if (/rate limit|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.'
  return msg
}

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/library'

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus()
  }, [step])

  if (!authLoading && user) return <Navigate to={redirectTo} replace />

  const sendCode = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      })
      if (error) throw error
      setStep('code')
      setCode('')
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err) {
      setError(cleanAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault()
    sendCode()
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.trim()
    if (!CODE_PATTERN.test(token)) {
      setError('Enter the numeric code from your email.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
      if (error) throw error
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(cleanAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div className="sidebar-logo-mark auth-logo">ST</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>
            {step === 'email' ? 'Sign in to ShelfTrack' : 'Check your email'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {step === 'email'
              ? 'Enter your email and we’ll send you a one-time code. New here? The same code creates your account.'
              : <>We sent a code to <strong style={{ color: 'var(--text-primary)' }}>{email.trim()}</strong>.</>}
          </p>
        </div>

        <div className="card-glass animate-fade-up" style={{ padding: 'var(--space-8)' }}>
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          {step === 'email' ? (
            <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" htmlFor="auth-email">Email address</label>
                <div className="input-group">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <button id="auth-send-code-btn" type="submit" className="btn btn-primary auth-submit" disabled={submitting || !email.trim()}>
                {submitting ? 'Sending code…' : <>Send code <ArrowRight size={16} /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label className="label" htmlFor="auth-code">One-time code</label>
                <div className="input-group">
                  <KeyRound size={16} className="input-icon" />
                  <input
                    ref={codeInputRef}
                    id="auth-code"
                    className="input otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="123456"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              <button id="auth-verify-btn" type="submit" className="btn btn-primary auth-submit" disabled={submitting || code.length < 6}>
                {submitting ? 'Verifying…' : <>Verify &amp; sign in <ArrowRight size={16} /></>}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setStep('email'); setError(null); setCode('') }}
                >
                  <ArrowLeft size={14} /> Change email
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={sendCode}
                  disabled={submitting || cooldown > 0}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          No password needed. ShelfTrack is free.
        </p>
      </div>
    </div>
  )
}
