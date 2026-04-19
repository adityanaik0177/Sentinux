import { useState, useEffect } from 'react'
import { supabase, onAuthStateChange } from './lib/supabase'
import Login from './components/Login'
import ModeSelector from './components/ModeSelector'
import PatDisplay from './components/PatDisplay'

// ── Auth Callback Handler ──────────────────────────────────────────────────
// Supabase redirects back to /auth/callback after GitHub OAuth.
// We detect this by checking for a code/token in the URL hash/search params,
// then let the Supabase client exchange it for a session automatically.
function isAuthCallback() {
  const hash   = window.location.hash
  const search = window.location.search
  return (
    hash.includes('access_token') ||
    hash.includes('error') ||
    search.includes('code=') ||
    search.includes('error=')
  )
}

export default function App() {
  const [user, setUser]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [selectedMode, setSelectedMode] = useState(null)  // 'autonomous' | 'guardian'
  const [pat, setPAT]                 = useState(null)

  useEffect(() => {
    // Explicitly get the session — this triggers Supabase to exchange
    // the access_token in the URL hash (from OAuth redirect) for a real session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Also listen for future auth state changes (sign in / sign out)
    const { data: { subscription } } = onAuthStateChange((authUser) => {
      setUser(authUser)
      setLoading(false)
    })

    return () => subscription?.unsubscribe()
  }, [])

  // ── Also restore an existing PAT from Supabase on login ─────────────────
  useEffect(() => {
    if (!user) return
    import('./lib/pat').then(({ getPAT }) => {
      getPAT().then((stored) => {
        if (stored && !pat) {
          setSelectedMode(stored.mode)
          setPAT(stored.pat)
        }
      })
    })
  }, [user])

  if (loading) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{
            width: 40, height: 40, border: '2px solid var(--glass-border)',
            borderTopColor: 'var(--neon-cyan)', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite', margin: '0 auto 1rem'
          }} />
          <p className="text-sm">Connecting to sentient core…</p>
        </div>
      </div>
    )
  }

  // Step 1 — Not logged in
  if (!user) return <Login />

  // Step 2 — Logged in, select mode (skip if already stored)
  if (!selectedMode) return (
    <ModeSelector
      user={user}
      onModeSelect={(mode, generatedPAT) => {
        setSelectedMode(mode)
        setPAT(generatedPAT)
      }}
    />
  )

  // Step 3 — Show PAT
  return <PatDisplay user={user} mode={selectedMode} pat={pat} />
}
