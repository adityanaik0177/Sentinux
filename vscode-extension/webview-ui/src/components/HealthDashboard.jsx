import { Activity, Copy, Check, Info, FileCode } from 'lucide-react'
import { useState } from 'react'
import { navigateTo } from '../lib/vscode'

// Clickable file+function label that jumps to the exact line
function NavLink({ file, line, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <span
      title={`Open ${file} at line ${line}`}
      onClick={() => navigateTo(file, line)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: hovered ? 'var(--ns-cyan)' : 'var(--ns-text-primary)',
        transition: 'color 0.15s',
        wordBreak: 'break-all',
      }}
    >
      <FileCode size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
      {children}
    </span>
  )
}

export default function HealthDashboard({ smells }) {
  const [copiedId, setCopiedId] = useState(null)
  
  if (!smells) return null

  if (!smells.dead_code?.length && !smells.duplicates?.length) {
    return (
      <div className="ns-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', gap: 10, textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0, 255, 170, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ns-safe)'
        }}>
          <Activity size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--ns-text-primary)' }}>Perfect Health</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--ns-text-dim)', marginTop: 4 }}>No architectural smells detected.</div>
        </div>
      </div>
    )
  }

  const handleCopy = async (id, text) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {/* ignore */}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 10 }}>

      {/* ── Duplicates ────────────────────────────────────────── */}
      {smells.duplicates?.map((dup, i) => {
        const id = `dup-${i}`
        return (
          <div key={id} className="ns-card" style={{ borderLeft: '3px solid var(--ns-warn)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <span className="ns-badge ns-badge-amber" style={{ marginBottom: 6 }}>Duplicate Logic</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  <NavLink file={dup.file} line={dup.line}>
                    {dup.function_name}
                  </NavLink>
                  {' '}
                  <span
                    title={`Open ${dup.file}`}
                    onClick={() => navigateTo(dup.file, dup.line)}
                    style={{ color: 'var(--ns-text-dim)', fontWeight: 400, cursor: 'pointer' }}
                  >
                    in {dup.file.split(/[/\\]/).pop()}:{dup.line}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{
              background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px',
              fontSize: '0.7rem', color: 'var(--ns-text-dim)', marginBottom: 8,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              Matches found:
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                {dup.duplicates.map((d, di) => (
                  <li key={di} style={{ marginBottom: 2, cursor: 'pointer' }}
                      onClick={() => navigateTo(d.file_path, 1)}
                      title={`Open ${d.file_path}`}
                  >
                    <code style={{ color: 'var(--ns-cyan)' }}>{d.function_name}</code>
                    {' '}in {d.file_path.split(/[/\\]/).pop()}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{
              background: 'rgba(0, 212, 255, 0.05)', borderRadius: 6, padding: '8px',
              border: '1px solid rgba(0, 212, 255, 0.1)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--ns-cyan)' }}>
                <Info size={12} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Suggestion</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--ns-text-secondary)', margin: 0, lineHeight: 1.5, paddingRight: 24 }}>
                {dup.suggestion}
              </p>
              <button 
                onClick={() => handleCopy(id, dup.suggestion)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: copiedId === id ? 'var(--ns-safe)' : 'var(--ns-text-dim)'
                }}
                title="Copy Suggestion"
              >
                {copiedId === id ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )
      })}

      {/* ── Dead Code ─────────────────────────────────────────── */}
      {smells.dead_code?.map((dc, i) => {
        const id = `dc-${i}`
        return (
          <div key={id} className="ns-card" style={{ borderLeft: '3px solid var(--ns-danger)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div>
                <span className="ns-badge ns-badge-red" style={{ marginBottom: 6 }}>Dead Code</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  <NavLink file={dc.file} line={dc.line}>
                    {dc.function_name}
                  </NavLink>
                  {' '}
                  <span
                    title={`Open ${dc.file}`}
                    onClick={() => navigateTo(dc.file, dc.line)}
                    style={{ color: 'var(--ns-text-dim)', fontWeight: 400, cursor: 'pointer' }}
                  >
                    in {dc.file.split(/[/\\]/).pop()}:{dc.line}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 59, 48, 0.05)', borderRadius: 6, padding: '8px',
              border: '1px solid rgba(255, 59, 48, 0.1)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--ns-danger)' }}>
                <Info size={12} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Suggestion</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--ns-text-secondary)', margin: 0, lineHeight: 1.5, paddingRight: 24 }}>
                {dc.suggestion}
              </p>
              <button 
                onClick={() => handleCopy(id, dc.suggestion)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: copiedId === id ? 'var(--ns-safe)' : 'var(--ns-text-dim)'
                }}
                title="Copy Suggestion"
              >
                {copiedId === id ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
