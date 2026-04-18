/**
 * DependencyGraph.jsx — Phase 4
 * Interactive reactflow dependency map.
 *
 * Node types:
 *   Producer:          Cyan glow border — defines exported symbols
 *   Consumer:          Orange fill — only imports
 *   Producer+Consumer: Violet — both exports and imports
 *   Inert:             Muted — neither
 *
 * Data shape (from nexusSentinel/getWorkspaceGraph):
 *   nodes: [{ id, label, role, symbols, freshness_score, consumer_count }]
 *   edges: [{ id, source, target, label }]
 */

import { useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react'
import { GitBranch, RefreshCw, Info } from 'lucide-react'

// ── Node color config ──────────────────────────────────────────────────────

const ROLE_STYLE = {
  'Producer': {
    border: '1.5px solid rgba(0,212,255,0.6)',
    background: 'rgba(0,212,255,0.07)',
    glow: '0 0 16px rgba(0,212,255,0.25)',
    dot: '#00d4ff',
  },
  'Consumer': {
    border: '1.5px solid rgba(255,107,53,0.5)',
    background: 'rgba(255,107,53,0.07)',
    glow: '0 0 12px rgba(255,107,53,0.2)',
    dot: '#ff6b35',
  },
  'Producer + Consumer': {
    border: '1.5px solid rgba(124,58,237,0.6)',
    background: 'rgba(124,58,237,0.07)',
    glow: '0 0 16px rgba(124,58,237,0.25)',
    dot: '#7c3aed',
  },
  'Inert': {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    glow: 'none',
    dot: '#444',
  },
}

// ── Custom Node Component ──────────────────────────────────────────────────

function SentinelNode({ data }) {
  const style = ROLE_STYLE[data.role] ?? ROLE_STYLE['Inert']
  const scoreColor =
    data.freshness_score >= 85 ? '#00ffaa'
    : data.freshness_score >= 60 ? '#ffd666'
    : '#ff6b35'

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 10,
      border: style.border,
      background: style.background,
      boxShadow: style.glow,
      backdropFilter: 'blur(8px)',
      minWidth: 120, maxWidth: 180,
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      color: '#e8e8f8',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}>
      {/* Role dot + filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: style.dot, flexShrink: 0,
          boxShadow: `0 0 6px ${style.dot}`,
        }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.label}
        </span>
      </div>
      {/* Role label */}
      <div style={{
        fontSize: 9, color: style.dot, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 5,
      }}>
        {data.role}
      </div>
      {/* F-Score bar */}
      {data.freshness_score !== undefined && (
        <div>
          <div style={{
            height: 3, borderRadius: 99,
            background: 'rgba(255,255,255,0.07)',
            overflow: 'hidden', marginBottom: 2,
          }}>
            <div style={{
              height: '100%',
              width: `${data.freshness_score}%`,
              background: scoreColor,
              borderRadius: 99,
              transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(232,232,248,0.4)' }}>
            <span>F-Score</span>
            <span style={{ color: scoreColor }}>{data.freshness_score}%</span>
          </div>
        </div>
      )}
      {/* Consumer count bubble */}
      {data.consumer_count > 0 && (
        <div style={{
          marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 9, padding: '1px 6px', borderRadius: 99,
          background: 'rgba(0,212,255,0.1)', color: '#00d4ff',
          border: '1px solid rgba(0,212,255,0.2)',
        }}>
          ↑ {data.consumer_count} consumer{data.consumer_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

const NODE_TYPES = { sentinel: SentinelNode }

// ── Layout (simple force-grid) ─────────────────────────────────────────────

function layoutNodes(rawNodes) {
  const COLS = 3
  const X_SPACE = 220
  const Y_SPACE = 160
  return rawNodes.map((n, i) => ({
    id: n.id,
    type: 'sentinel',
    position: { x: (i % COLS) * X_SPACE, y: Math.floor(i / COLS) * Y_SPACE },
    data: n,
  }))
}

function buildEdges(rawEdges) {
  return rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(0,212,255,0.5)' },
    style: { stroke: 'rgba(0,212,255,0.3)', strokeWidth: 1.5 },
    labelStyle: { fill: 'rgba(232,232,248,0.4)', fontSize: 9, fontFamily: "'Inter', sans-serif" },
    labelBgStyle: { fill: 'rgba(11,11,24,0.8)', borderRadius: 4 },
  }))
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DependencyGraph({ data }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Re-sync whenever the data prop changes (fixes stale initial state)
  useEffect(() => {
    if (!data) return
    setNodes(layoutNodes(data.nodes ?? []))
    setEdges(buildEdges(data.edges ?? []))
  }, [data, setNodes, setEdges])

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10,
        height: '100%', textAlign: 'center', padding: '2rem',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GitBranch size={20} color="var(--ns-text-dim)" />
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--ns-text-dim)', lineHeight: 1.65 }}>
          Click the <strong style={{ color: 'var(--ns-cyan)' }}>Graph</strong> tab<br />
          to crawl and visualise your workspace.
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: 'transparent' }}
      >
        <Background
          variant="dots"
          gap={20}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => ROLE_STYLE[n.data?.role]?.dot ?? '#444'}
          maskColor="rgba(0,0,0,0.5)"
          style={{ width: 100, height: 60 }}
        />
        <Panel position="top-right" style={{ margin: 6 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 8px', borderRadius: 6,
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 10, color: 'rgba(232,232,248,0.5)',
          }}>
            <Info size={9} />
            {data.nodes?.length ?? 0} files · {data.edges?.length ?? 0} edges
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
