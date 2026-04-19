/**
 * BlastRadiusReport.jsx — Phase 3
 * List view showing all consumer files impacted by a Producer change.
 *
 * Each row shows:
 *  - Consumer filename
 *  - Consumer role (Producer / Consumer / Both)
 *  - Severity indicator (warning icon pulsing red)
 *  - Contract code NST-001
 */

import { Zap, FileCode, ChevronRight, AlertTriangle, Info } from 'lucide-react'

// Post navigateTo message to VS Code extension host
function navigateTo(file, line = 1) {
  try {
    // eslint-disable-next-line no-undef
    const vsc = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null
    vsc?.postMessage({ type: 'navigateTo', file, line })
  } catch {
    // Not in VS Code webview — ignore
  }
}

function RolePill({ role }) {
  const cfg = {
    'Producer':           { cls: 'ns-badge-cyan',   label: 'P' },
    'Consumer':           { cls: 'ns-badge-warn',   label: 'C' },
    'Producer + Consumer':{ cls: 'ns-badge-cyan',   label: 'P+C' },
    'Inert':              { cls: 'ns-badge-safe',   label: '—' },
  }[role] ?? { cls: 'ns-badge-cyan', label: '?' }

  return (
    <span className={`ns-badge ${cfg.cls}`} style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
      {cfg.label}
    </span>
  )
}

export default function BlastRadiusReport({ report }) {
  const consumers = report
    ? Object.entries(report.affected_consumers ?? {})
    : []

  const isEmpty = consumers.length === 0

  return (
    <div className="ns-panel ns-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', flexShrink: 0, borderBottom: '1px solid var(--ns-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} color={isEmpty ? 'var(--ns-text-dim)' : 'var(--ns-warn)'} />
          <span className="ns-label">Blast Radius</span>
          <span style={{ flex: 1 }} />
          {!isEmpty && (
            <span className="ns-badge ns-badge-warn">
              {consumers.length} affected
            </span>
          )}
          {isEmpty && report && (
            <span className="ns-badge ns-badge-safe">Zero radius</span>
          )}
        </div>

        {report && (
          <div style={{ marginTop: 6, fontSize: '0.68rem', color: 'var(--ns-text-dim)' }}>
            Producer:{' '}
            <span style={{ color: 'var(--ns-text)', fontFamily: 'var(--ns-mono)', fontSize: '0.68rem' }}>
              {report.file ?? '—'}
            </span>
            <span style={{ marginLeft: 8, color: 'var(--ns-text-muted)' }}>
              [{report.role ?? '—'}]
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="ns-scroll" style={{ flex: 1 }}>
        {!report && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '2rem 1rem', textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Info size={18} color="var(--ns-text-dim)" />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ns-text-dim)', lineHeight: 1.6 }}>
              Save a Python file to see<br />its Blast Radius here.
            </p>
          </div>
        )}

        {report && isEmpty && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '2rem 1rem', textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(0,255,170,0.07)', border: '1px solid rgba(0,255,170,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={18} color="var(--ns-safe)" />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ns-text-dim)', lineHeight: 1.6 }}>
              No consumers affected.<br />
              <span style={{ color: 'var(--ns-safe)' }}>Blast Radius = 0</span>
            </p>
          </div>
        )}

        {consumers.map(([consumerPath, diagnostics], i) => {
          const filename = consumerPath.split(/[\/\\]/).pop()
          const diag = diagnostics?.[0]

          return (
            <div
              key={consumerPath}
              className="ns-fade-in"
              onClick={() => navigateTo(consumerPath, 1)}
              title={`Open ${consumerPath}`}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px',
                borderBottom: i < consumers.length - 1 ? '1px solid var(--ns-border)' : 'none',
                animationDelay: `${i * 0.05}s`,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Warning dot */}
              <div style={{
                flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
                background: 'var(--ns-warn)',
                boxShadow: '0 0 8px var(--ns-warn)',
                marginTop: 6,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: -3, borderRadius: '50%',
                  border: '1.5px solid var(--ns-warn)',
                  opacity: 0.4,
                  animation: 'ns-pulse-ring 2s ease-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <FileCode size={11} color="var(--ns-cyan)" />
                  <span style={{
                    fontFamily: 'var(--ns-mono)', fontSize: '0.72rem',
                    color: 'var(--ns-cyan)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: 'underline', textUnderlineOffset: 2,
                  }}>
                    {filename}
                  </span>
                </div>

                {diag && (
                  <p style={{
                    fontSize: '0.66rem', color: 'var(--ns-text-dim)',
                    lineHeight: 1.55,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {diag.message?.split('\n')[1] ?? diag.message}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                  <span style={{
                    fontFamily: 'var(--ns-mono)', fontSize: '0.58rem',
                    color: 'var(--ns-warn)', opacity: 0.8,
                  }}>
                    {diag?.code ?? 'NST-001'}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ns-text-muted)' }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--ns-text-muted)' }}>
                    {diag?.source ?? 'Nexus-Sentinel'}
                  </span>
                </div>
              </div>

              <AlertTriangle size={13} color="var(--ns-warn)" style={{ flexShrink: 0, marginTop: 4 }} />
            </div>
          )
        })}
      </div>

      {/* Exported symbols */}
      {report?.exported_symbols?.length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--ns-border)', flexShrink: 0 }}>
          <div className="ns-label" style={{ marginBottom: 5 }}>Exported Symbols</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {report.exported_symbols.slice(0, 8).map((sym) => (
              <span key={sym} style={{
                fontFamily: 'var(--ns-mono)', fontSize: '0.62rem',
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(0,212,255,0.07)',
                border: '1px solid rgba(0,212,255,0.15)',
                color: 'var(--ns-cyan)',
              }}>
                {sym}
              </span>
            ))}
            {report.exported_symbols.length > 8 && (
              <span style={{ fontSize: '0.62rem', color: 'var(--ns-text-muted)', alignSelf: 'center' }}>
                +{report.exported_symbols.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
