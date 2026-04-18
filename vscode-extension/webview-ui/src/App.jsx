import { useState, useEffect, useCallback } from 'react'
import FreshnessMeter from './components/FreshnessMeter'
import BlastRadiusReport from './components/BlastRadiusReport'
import DependencyGraph from './components/DependencyGraph'
import HealthDashboard from './components/HealthDashboard'
import { Shield, GitBranch, Zap, Activity } from 'lucide-react'

// acquireVsCodeApi is injected by VS Code into the webview global scope.
// When running in a browser (dev mode), we fall back to a no-op stub.
const vscode = (() => {
  try {
    // eslint-disable-next-line no-undef
    return typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null
  } catch {
    return null
  }
})()

const TABS = [
  { id: 'pulse',  label: 'Pulse',  Icon: Zap },
  { id: 'health', label: 'Health', Icon: Activity },
  { id: 'graph',  label: 'Graph',  Icon: GitBranch },
]

export default function App() {
  const [tab, setTab] = useState('pulse')
  const [blastReport, setBlastReport] = useState(null)
  const [graphData, setGraphData]     = useState(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [healthSmells, setHealthSmells] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [mode, setMode]               = useState('guardian')
  const [lspReady, setLspReady]       = useState(false)

  // ── VS Code message bridge ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      const msg = event.data
      switch (msg.type) {
        case 'init':
          setMode(msg.payload?.mode ?? 'guardian')
          setLspReady(true)
          // Auto-populate: request the workspace graph immediately
          vscode?.postMessage({ type: 'requestGraph' })
          // Also request blast radius for whatever file is active
          vscode?.postMessage({ type: 'requestActiveFilePulse' })
          // Request health smells 
          vscode?.postMessage({ type: 'requestHealthSmells' })
          break
        case 'blastRadiusReport':
          setBlastReport(msg.payload)
          break
        case 'workspaceGraph':
          setGraphData(msg.payload)
          setGraphLoading(false)
          break
        case 'healthSmells':
          setHealthSmells(msg.payload)
          setHealthLoading(false)
          break
      }
    }
    window.addEventListener('message', handler)
    // Signal ready to extension host
    vscode?.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const requestGraph = useCallback(() => {
    setTab('graph')
    setGraphLoading(true)
    vscode?.postMessage({ type: 'requestGraph' })
  }, [])

  const requestHealth = useCallback(() => {
    setTab('health')
    setHealthLoading(true)
    vscode?.postMessage({ type: 'requestHealthSmells' })
  }, [])

  // ── Freshness score from blast report ─────────────────────────────────────
  const freshnessScore = blastReport?.freshness_score ?? 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '10px', gap: 8 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--ns-cyan), var(--ns-violet))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 0 16px rgba(0,212,255,0.25)',
        }}>
          <Shield size={15} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '-0.01em' }}>
            Nexus<span style={{ color: 'var(--ns-cyan)' }}>-Sentinel</span>
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--ns-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lspReady ? (
              <span style={{ color: 'var(--ns-safe)' }}>● Brain Connected</span>
            ) : (
              <span style={{ color: 'var(--ns-text-muted)' }}>○ Connecting…</span>
            )}
          </div>
        </div>
        <div className="ns-badge ns-badge-cyan" style={{ fontSize: '0.6rem' }}>
          {mode === 'guardian' ? '👁 Guardian' : '⚡ Auto'}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--ns-surface)', border: '1px solid var(--ns-border)',
        borderRadius: 8, padding: 3,
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={
              id === 'graph' ? requestGraph : id === 'health' ? requestHealth : () => setTab(id)
            }
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '5px 8px', border: 'none', borderRadius: 6,
              fontFamily: 'var(--ns-font)', fontSize: '0.72rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: tab === id ? 'rgba(0,212,255,0.12)' : 'transparent',
              color: tab === id ? 'var(--ns-cyan)' : 'var(--ns-text-dim)',
              letterSpacing: '0.04em',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'pulse' && (
          <div className="ns-scroll ns-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FreshnessMeter score={freshnessScore} file={blastReport?.file} />
            <BlastRadiusReport report={blastReport} />
          </div>
        )}
        {tab === 'health' && (
          <div className="ns-scroll ns-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {healthLoading && !healthSmells && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--ns-text-dim)', fontSize: '0.7rem' }}>Scanning architecture...</div>
            )}
            <HealthDashboard smells={healthSmells} />
          </div>
        )}
        {tab === 'graph' && (
          <div className="ns-fade-in" style={{ flex: 1, position: 'relative' }}>
            {graphLoading && !graphData && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '2px solid rgba(0,212,255,0.15)',
                  borderTop: '2px solid var(--ns-cyan)',
                  animation: 'ns-spin 0.8s linear infinite',
                }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--ns-text-dim)' }}>Crawling workspace…</span>
              </div>
            )}
            <DependencyGraph data={graphData} />
          </div>
        )}
      </div>
    </div>
  )
}
