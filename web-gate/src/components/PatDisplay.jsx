import { useState } from 'react'
import { Copy, Check, Terminal, RefreshCw, LogOut } from 'lucide-react'
import { signOut } from '../lib/supabase'

export default function PatDisplay({ user, mode, pat }) {
  const [copied, setCopied] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pat)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for non-HTTPS
      const ta = document.createElement('textarea')
      ta.value = pat
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut().catch(() => {})
    window.location.reload()
  }

  const modeLabel = mode === 'guardian' ? 'Guardian (Manual Approval)' : 'Autonomous (Auto-sync Docs)'
  const modeColor = mode === 'guardian' ? 'var(--neon-cyan)' : '#7c3aed'

  return (
    <div className="page">
      <div className="glass-card animate-fade-up" style={{ maxWidth: 520, width: '100%', padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em',
            color: 'var(--neon-safe)', textTransform: 'uppercase',
            background: 'rgba(0,255,170,0.08)', padding: '4px 12px',
            borderRadius: 99, border: '1px solid rgba(0,255,170,0.2)',
            marginBottom: '1rem',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon-safe)', boxShadow: '0 0 8px var(--neon-safe)' }} />
            Guardian Activated
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
            Your Personal Access Token
          </h2>
          <p className="text-sm text-muted" style={{ lineHeight: 1.65 }}>
            Paste this into VS Code:{' '}
            <span className="mono" style={{ color: 'var(--text-primary)', fontSize: '0.78rem' }}>
              Settings → Nexus-Sentinel: PAT
            </span>
          </p>
        </div>

        {/* Mode badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: 'var(--glass-fill)', border: '1px solid var(--glass-border)',
          borderRadius: 10, marginBottom: '1.25rem',
        }}>
          <span className="text-xs text-muted">Mode</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: modeColor }}>
            {modeLabel}
          </span>
        </div>

        {/* PAT box */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--glass-border)',
          borderRadius: 12, padding: '1.25rem 1rem',
          marginBottom: '1rem',
          position: 'relative',
        }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
            Access Token
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <code className="mono" style={{
              flex: 1, fontSize: '0.82rem', color: 'var(--neon-cyan)',
              overflowX: 'auto', wordBreak: 'break-all',
              lineHeight: 1.5,
            }}>
              {pat}
            </code>
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              style={{
                flexShrink: 0, background: 'none', border: 'none',
                cursor: 'pointer', padding: 6, borderRadius: 8,
                color: copied ? 'var(--neon-safe)' : 'var(--text-secondary)',
                transition: 'color 0.2s',
              }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* ── install.md prerequisite notice ───────────────────────────── */}
        <div style={{
          background: 'rgba(255,200,0,0.05)',
          border: '1px solid rgba(255,200,0,0.25)',
          borderRadius: 10, padding: '1rem 1.1rem',
          marginBottom: '1.25rem',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>📋</span>
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffd666', marginBottom: '0.35rem' }}>
              Before copying this token, follow the setup guide first!
            </p>
            <p style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              The extension requires Python, a virtual environment, and your{' '}
              <code style={{ fontSize: '0.74rem', color: '#ffd666', background: 'rgba(255,200,0,0.1)', padding: '1px 5px', borderRadius: 4 }}>.env</code>{' '}
              file to be configured before the token will work.
            </p>
            <a
              href="https://github.com/adityanaik0177/Sentinux/blob/main/install.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: '0.78rem', fontWeight: 600, color: '#ffd666',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,200,0,0.35)',
                paddingBottom: 1,
                transition: 'color 0.2s',
              }}
            >
              📖 Read install.md on GitHub →
            </a>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          background: 'rgba(0,212,255,0.04)',
          border: '1px solid rgba(0,212,255,0.12)',
          borderRadius: 10, padding: '1.25rem',
          marginBottom: '1.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <Terminal size={15} style={{ color: 'var(--neon-cyan)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Paste into VS Code — 4 steps
            </p>
          </div>

          {[
            {
              n: 1,
              text: <>Open VS Code Settings&nbsp;&nbsp;<kbd style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: '0.73rem' }}>Ctrl+,</kbd></>,
            },
            {
              n: 2,
              text: <>Search for <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--neon-cyan)', background: 'rgba(0,212,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>nexusSentinel.pat</code></>,
            },
            {
              n: 3,
              text: <>Paste your token into the <strong>Nexus-Sentinel: Pat</strong> field</>,
            },
            {
              n: 4,
              text: <>Reload: <kbd style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: '0.73rem' }}>Ctrl+Shift+P</kbd> → <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--neon-cyan)' }}>Developer: Reload Window</code></>,
            },
          ].map(({ n, text }) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: n < 4 ? '0.65rem' : 0 }}>
              <div style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--neon-cyan)',
              }}>
                {n}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: 1 }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', gap: 8, fontSize: '0.85rem' }} onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Regenerate
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', gap: 8, fontSize: '0.85rem' }} onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={15} /> {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
