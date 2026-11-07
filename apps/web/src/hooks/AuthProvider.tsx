import { useEffect, useState, type ReactNode } from 'react'
import { supabase, type Session } from '../lib/supabaseClient'
import type { Profile } from '../lib/types'
import { AuthContext } from './useAuth'

const fetchProfile = async (userId: string) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Ensure profile exists for authenticated user and fetch it.
  // getSession() and onAuthStateChange both fire on load, so this can run twice
  // concurrently — ignoreDuplicates makes the create idempotent, and we always
  // re-read the row rather than trusting the insert result.
  const ensureAndFetchProfile = async (userId: string, email?: string) => {
    try {
      let prof = await fetchProfile(userId)
      if (!prof) {
        const defaultUsername = email ? email.split('@')[0] : `user_${userId.slice(0, 6)}`
        await supabase
          .from('profiles')
          .upsert({ id: userId, username: defaultUsername }, { onConflict: 'id', ignoreDuplicates: true })
        prof = await fetchProfile(userId)
      }
      if (prof) setProfile(prof)
    } catch (error) {
      console.error('Failed to ensure profile exists:', error)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        ensureAndFetchProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        ensureAndFetchProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (!session?.user) return
    const prof = await fetchProfile(session.user.id)
    if (prof) setProfile(prof)
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

