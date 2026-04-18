import { useState } from 'react'
import { Github, Shield, Zap } from 'lucide-react'
import { signInWithGitHub } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGitHubLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      await signInWithGitHub()
    } catch (err) {
      setError(err.message || 'Authentication failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="glass-card animate-fade-up" style={{
        maxWidth: 440,
        width: '100%',
        padding: '3rem 2.5rem',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-violet) 100%)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 40px rgba(0,212,255,0.3)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
            <Shield size={30} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
            Nexus<span style={{ color: 'var(--neon-cyan)' }}>-Sentinel</span>
          </h1>
          <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
            Your self-healing architectural guardian.<br />
            Read-only. Always watching.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {['Blast Radius', 'F-Score', 'Zero Writes'].map((tag) => (
            <span key={tag} style={{
              fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
              padding: '4px 10px', borderRadius: 99,
              background: 'var(--neon-cyan-dim)',
              border: '1px solid rgba(0,212,255,0.2)',
              color: 'var(--neon-cyan)',
              textTransform: 'uppercase',
            }}>{tag}</span>
          ))}
        </div>

        {/* Auth button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.95rem', padding: '14px 24px' }}
          onClick={handleGitHubLogin}
          disabled={loading}
        >
          {loading ? (
            <div style={{
              width: 18, height: 18,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          ) : (
            <Github size={20} />
          )}
          {loading ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
        </button>

        {error && (
          <p style={{
            marginTop: '1rem', fontSize: '0.8rem', color: 'var(--neon-warn)',
            background: 'rgba(255,107,53,0.1)', padding: '10px 14px',
            borderRadius: 8, border: '1px solid rgba(255,107,53,0.2)',
          }}>
            {error}
          </p>
        )}

        <p className="text-xs text-muted" style={{ marginTop: '1.75rem' }}>
          By continuing, you agree that Nexus-Sentinel will{' '}
          <strong style={{ color: 'var(--neon-safe)' }}>never modify</strong>{' '}
          your source code.
        </p>
      </div>
    </div>
  )
}
