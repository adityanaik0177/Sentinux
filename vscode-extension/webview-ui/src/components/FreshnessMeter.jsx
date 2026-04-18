/**
 * FreshnessMeter.jsx — Phase 3
 * Radial gauge + numeric display for the F-Score of the active file.
 *
 * F-Score:  100 = all imported symbols still exist in producers (contract intact)
 *           < 80 = contract drift detected
 *           < 50 = critical — producers have changed significantly
 */

import { useMemo } from 'react'
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

// SVG arc path generator
function describeArc(cx, cy, r, startAngle, endAngle) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

const START_ANGLE = 145
const END_ANGLE   = 395  // 250° sweep

function getScoreColor(score) {
  if (score >= 85) return 'var(--ns-safe)'
  if (score >= 60) return '#ffd666'
  return 'var(--ns-warn)'
}

function getScoreLabel(score) {
  if (score >= 85) return { text: 'Healthy', badge: 'ns-badge-safe', Icon: CheckCircle }
  if (score >= 60) return { text: 'Drifting', badge: 'ns-badge-warn', Icon: AlertTriangle }
  return { text: 'Critical', badge: 'ns-badge-danger', Icon: AlertTriangle }
}

export default function FreshnessMeter({ score = 100, file = null }) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const color = getScoreColor(clampedScore)
  const label = getScoreLabel(clampedScore)
  const { Icon } = label

  // Arc geometry
  const sweepDeg = (clampedScore / 100) * (END_ANGLE - START_ANGLE)
  const arcEnd   = START_ANGLE + sweepDeg

  const trackPath = useMemo(() => describeArc(60, 60, 46, START_ANGLE, END_ANGLE), [])
  const scorePath = useMemo(() => {
    if (clampedScore === 0) return ''
    return describeArc(60, 60, 46, START_ANGLE, arcEnd)
  }, [clampedScore, arcEnd])

  return (
    <div className="ns-panel" style={{ padding: '14px', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <TrendingUp size={13} color="var(--ns-text-dim)" />
        <span className="ns-label">Freshness Score</span>
        <span style={{ flex: 1 }} />
        <span className={`ns-badge ${label.badge}`}>
          <Icon size={9} />
          {label.text}
        </span>
      </div>

      {/* Gauge + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* SVG Radial Gauge */}
        <svg width={120} height={90} viewBox="0 0 120 80" style={{ flexShrink: 0 }}>
          {/* Track */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
            strokeLinecap="round"
          />
          {/* Score arc */}
          {scorePath && (
            <path
              d={scorePath}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${color}88)`,
                transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          )}
          {/* Center text */}
          <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="700"
            fill={color} fontFamily="'Inter', sans-serif"
            style={{ transition: 'fill 0.4s' }}>
            {clampedScore}
          </text>
          <text x="60" y="67" textAnchor="middle" fontSize="8" fill="rgba(232,232,248,0.4)"
            fontFamily="'Inter', sans-serif">
            / 100
          </text>
        </svg>

        {/* Detail column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--ns-text-dim)', marginBottom: 6 }}>
            Active File
          </div>
          <div style={{
            fontFamily: 'var(--ns-mono)', fontSize: '0.72rem',
            color: file ? 'var(--ns-text)' : 'var(--ns-text-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 10,
          }}>
            {file ?? '—  save a .py file'}
          </div>

          {/* Score bar */}
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${clampedScore}%`,
              background: `linear-gradient(90deg, ${color}88, ${color})`,
              boxShadow: `0 0 8px ${color}66`,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: '0.6rem', color: 'var(--ns-text-muted)' }}>F-Score</span>
            <span style={{ fontSize: '0.6rem', color }}>
              {clampedScore >= 85 ? 'Contract intact' : clampedScore >= 60 ? 'Drift detected' : 'Review required'}
            </span>
          </div>
        </div>
      </div>

      {/* Formula hint */}
      <div style={{
        marginTop: 10, padding: '6px 10px',
        background: 'rgba(0,0,0,0.2)', borderRadius: 6,
        fontSize: '0.62rem', color: 'var(--ns-text-muted)',
        fontFamily: 'var(--ns-mono)',
      }}>
        F = (matched_sigs / total_deps) × 100
      </div>
    </div>
  )
}
