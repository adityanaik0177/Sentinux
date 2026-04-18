import { useState } from 'react'
import { Zap, Eye, ChevronRight, Check } from 'lucide-react'
import { generatePAT, savePAT } from '../lib/pat'

const MODES = [
  {
    id: 'guardian',
    icon: Eye,
    title: 'Guardian Mode',
    subtitle: 'Manual Approval',
    description:
      'Every Blast Radius warning appears in the VS Code sidebar. You review and acknowledge each impact before proceeding. Perfect for critical production services.',
    color: '#00d4ff',
    glow: 'rgba(0,212,255,0.15)',
  },
  {
    id: 'autonomous',
    icon: Zap,
    title: 'Autonomous Mode',
    subtitle: 'Auto-sync Docs',
    description:
      'Nexus-Sentinel automatically tracks contract drift and syncs documentation. Blast Radius reports are generated silently and surfaced as a digest. Best for fast-moving projects.',
    color: '#7c3aed',
    glow: 'rgba(124,58,237,0.15)',
  },
]

export default function ModeSelector({ user, onModeSelect }) {
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const pat = generatePAT()
      await savePAT(pat, selected)
      onModeSelect(selected, pat)
    } catch (err) {
      // If save fails (e.g. table not created), still generate PAT locally
      console.warn('Could not persist PAT to Supabase:', err.message)
      const pat = generatePAT()
      onModeSelect(selected, pat)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div className="animate-fade-up" style={{ textAlign: 'center', maxWidth: 520 }}>
        <p className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Welcome, <span style={{ color: 'var(--neon-cyan)' }}>{user?.user_metadata?.user_name ?? user?.email}</span>
        </p>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Select Your Guardian Mode
        </h2>
        <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
          This determines how Nexus-Sentinel surfaces architectural insights inside VS Code.
        </p>
      </div>

      {/* Mode Cards */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, width: '100%' }}>
        {MODES.map((mode, i) => {
          const Icon = mode.icon
          const isSelected = selected === mode.id
          return (
            <button
              key={mode.id}
              onClick={() => setSelected(mode.id)}
              className={`glass-card animate-fade-up animate-delay-${i + 1}`}
              style={{
                flex: '1 1 280px', maxWidth: 320,
                padding: '2rem 1.75rem',
                textAlign: 'left',
                cursor: 'pointer',
                border: isSelected
                  ? `1px solid ${mode.color}`
                  : '1px solid var(--glass-border)',
                boxShadow: isSelected
                  ? `0 0 40px ${mode.glow}, 0 8px 32px rgba(0,0,0,0.4)`
                  : 'var(--shadow-card)',
                transform: isSelected ? 'translateY(-4px)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                background: isSelected ? `${mode.glow}` : 'var(--glass-fill)',
              }}
            >
              {/* Check badge */}
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 22, height: 22, borderRadius: '50%',
                  background: mode.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={13} color="#000" strokeWidth={3} />
                </div>
              )}

              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `linear-gradient(135deg, ${mode.color}22 0%, ${mode.color}44 100%)`,
                border: `1px solid ${mode.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem',
              }}>
                <Icon size={22} color={mode.color} />
              </div>

              <h3 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                {mode.title}
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: mode.color, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {mode.subtitle}
              </p>
              <p className="text-sm text-muted" style={{ lineHeight: 1.65 }}>
                {mode.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Confirm */}
      <div className="animate-fade-up animate-delay-3">
        {error && (
          <p style={{ color: 'var(--neon-warn)', fontSize: '0.8rem', textAlign: 'center', marginBottom: '1rem' }}>
            {error}
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={!selected || loading}
          style={{
            opacity: selected ? 1 : 0.4, cursor: selected ? 'pointer' : 'not-allowed',
            padding: '14px 40px', fontSize: '0.95rem',
          }}
        >
          {loading ? (
            <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : <ChevronRight size={18} />}
          {loading ? 'Generating Token…' : 'Confirm Mode & Generate PAT'}
        </button>
      </div>
    </div>
  )
}
