/**
 * DependencyGraph.jsx — Schema-Style Dependency Map
 * ===================================================
 * Renders each Python file as a "table card" (like Supabase schema editor)
 * listing exported symbols. Edges draw from the importing file's symbol row
 * directly to the producing file's matching symbol row.
 *
 * Data shape (from nexusSentinel/getWorkspaceGraph):
 *   nodes: [{ id, label, role, symbols[], imports[], imported_modules[] }]
 *   edges: [{ id, source, target, module, imported_symbols[] }]
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react'
import { GitBranch, Box, Download, Upload } from 'lucide-react'

// ── Role palette ───────────────────────────────────────────────────────────

const ROLE_PALETTE = {
  'Producer': {
    header: 'linear-gradient(135deg,rgba(0,212,255,0.25),rgba(0,212,255,0.08))',
    border: '1.5px solid rgba(0,212,255,0.55)',
    dot: '#00d4ff',
    icon: Upload,
    glow: '0 0 20px rgba(0,212,255,0.18)',
  },
  'Consumer': {
    header: 'linear-gradient(135deg,rgba(255,107,53,0.22),rgba(255,107,53,0.06))',
    border: '1.5px solid rgba(255,107,53,0.5)',
    dot: '#ff6b35',
    icon: Download,
    glow: '0 0 16px rgba(255,107,53,0.18)',
  },
  'Producer + Consumer': {
    header: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(124,58,237,0.08))',
    border: '1.5px solid rgba(124,58,237,0.55)',
    dot: '#7c3aed',
    icon: Box,
    glow: '0 0 20px rgba(124,58,237,0.2)',
  },
  'Inert': {
    header: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    dot: '#555',
    icon: Box,
    glow: 'none',
  },
}

// ── Schema Node ────────────────────────────────────────────────────────────

function SchemaNode({ id, data }) {
  const palette = ROLE_PALETTE[data.role] ?? ROLE_PALETTE['Inert']
  const Icon = palette.icon
  const symbols = data.symbols ?? []
  const imports = data.imports ?? []

  return (
    <div style={{
      minWidth: 175, maxWidth: 210,
      borderRadius: 10,
      border: palette.border,
      background: 'rgba(10,10,22,0.88)',
      boxShadow: palette.glow,
      backdropFilter: 'blur(10px)',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 11,
      color: '#d0d0e8',
      overflow: 'visible',
      position: 'relative',
    }}>
      {/* ── Header ── */}
      <div style={{
        background: palette.header,
        padding: '7px 10px',
        borderRadius: '8px 8px 0 0',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: palette.border,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: palette.dot,
          boxShadow: `0 0 8px ${palette.dot}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontWeight: 700, fontSize: 10.5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: '#f0f0ff', flex: 1,
        }}>
          {data.label}
        </span>
        <span style={{
          fontSize: 8.5, color: palette.dot,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          background: `${palette.dot}18`,
          padding: '1px 5px', borderRadius: 4,
          flexShrink: 0,
        }}>
          {data.role}
        </span>
      </div>

      {/* ── Exported Symbols (output handles on the right) ── */}
      {symbols.length > 0 && (
        <div>
          <div style={{
            fontSize: 8.5, color: 'rgba(0,212,255,0.6)',
            padding: '5px 10px 2px',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Exports
          </div>
          {symbols.map((sym) => (
            <div key={sym} style={{
              display: 'flex', alignItems: 'center',
              padding: '3px 10px 3px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              position: 'relative',
              gap: 6,
            }}>
              <span style={{ color: '#00d4ff', fontSize: 9 }}>fn</span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', color: '#c8e0ff', fontSize: 10,
              }}>
                {sym}
              </span>
              {/* Right handle for each exported symbol */}
              <Handle
                type="source"
                id={`sym-${sym}`}
                position={Position.Right}
                style={{
                  background: '#00d4ff',
                  width: 7, height: 7,
                  border: '1.5px solid rgba(0,212,255,0.3)',
                  right: -4,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Imported Names (input handles on the left) ── */}
      {imports.length > 0 && (
        <div>
          <div style={{
            fontSize: 8.5, color: 'rgba(255,107,53,0.7)',
            padding: '5px 10px 2px',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Imports
          </div>
          {imports.map((imp) => (
            <div key={imp} style={{
              display: 'flex', alignItems: 'center',
              padding: '3px 10px 3px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              position: 'relative',
              gap: 6,
            }}>
              {/* Left handle for each import */}
              <Handle
                type="target"
                id={`imp-${imp}`}
                position={Position.Left}
                style={{
                  background: '#ff6b35',
                  width: 7, height: 7,
                  border: '1.5px solid rgba(255,107,53,0.3)',
                  left: -4,
                }}
              />
              <span style={{ color: '#ff6b35', fontSize: 9 }}>↓</span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', color: '#ffa880', fontSize: 10,
              }}>
                {imp}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom padding */}
      <div style={{ height: 5 }} />

      {/* Default handles for file-level connections */}
      <Handle type="source" position={Position.Right}
        id="file-out"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle type="target" position={Position.Left}
        id="file-in"
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

const NODE_TYPES = { schema: SchemaNode }

// ── Layout ───────────────────────────────────────────────────────────────────

function layoutNodes(rawNodes) {
  // Group by role for visual clustering
  const ORDER = ['Producer', 'Producer + Consumer', 'Consumer', 'Inert']
  const sorted = [...rawNodes].sort(
    (a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role)
  )

  const COLS = 3
  const X_GAP = 260
  const Y_GAP = 40  // reduced gap — symbol rows make nodes taller
  const heights = sorted.map(n =>
    72 + (n.symbols?.length ?? 0) * 22 + (n.imports?.length ?? 0) * 22
  )

  const laid = []
  let col = 0, row = 0, rowMaxH = 0, yOffset = 0

  sorted.forEach((n, i) => {
    laid.push({
      id: n.id,
      type: 'schema',
      position: { x: col * X_GAP, y: yOffset },
      data: n,
    })
    rowMaxH = Math.max(rowMaxH, heights[i])
    col++
    if (col >= COLS) {
      col = 0
      row++
      yOffset += rowMaxH + Y_GAP
      rowMaxH = 0
    }
  })
  return laid
}

function buildEdges(rawEdges) {
  return rawEdges.flatMap((e) => {
    const syms = e.imported_symbols ?? []

    if (syms.length === 0) {
      // Fall back to a generic file-level edge
      return [{
        id: e.id ?? `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        sourceHandle: 'file-out',
        targetHandle: 'file-in',
        type: 'smoothstep',
        animated: true,
        label: e.module,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(0,212,255,0.5)' },
        style: { stroke: 'rgba(0,212,255,0.25)', strokeWidth: 1.5, strokeDasharray: '4 3' },
        labelStyle: { fill: 'rgba(200,200,240,0.5)', fontSize: 8.5 },
        labelBgStyle: { fill: 'rgba(8,8,20,0.85)', borderRadius: 4 },
      }]
    }

    // One edge per imported symbol — drawn handle-to-handle
    return syms.map((sym, idx) => ({
      id: `${e.id ?? e.source}-${sym}-${idx}`,
      source: e.target,          // symbol "comes FROM" the producer
      target: e.source,          // "goes TO" the consumer
      sourceHandle: `sym-${sym}`,
      targetHandle: `imp-${sym}`,
      type: 'smoothstep',
      animated: true,
      label: sym,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(124,58,237,0.7)' },
      style: { stroke: 'rgba(124,58,237,0.45)', strokeWidth: 1.5 },
      labelStyle: { fill: 'rgba(200,180,255,0.7)', fontSize: 8.5 },
      labelBgStyle: { fill: 'rgba(8,8,20,0.85)', borderRadius: 4 },
    }))
  })
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function DependencyGraph({ data }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (!data) return
    setNodes(layoutNodes(data.nodes ?? []))
    setEdges(buildEdges(data.edges ?? []))
  }, [data, setNodes, setEdges])

  if (!data) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12,
        height: '100%', textAlign: 'center', padding: '2rem',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.14)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GitBranch size={22} color="var(--ns-text-dim)" />
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--ns-text-dim)', lineHeight: 1.7, maxWidth: 180 }}>
          Click the <strong style={{ color: 'var(--ns-cyan)' }}>Graph</strong> tab
          to crawl your workspace and visualise the schema-style dependency map.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { color: '#00d4ff', label: 'Producer (exports symbols)' },
            { color: '#ff6b35', label: 'Consumer (imports only)' },
            { color: '#7c3aed', label: 'Producer + Consumer' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 10, color: 'rgba(200,200,240,0.6)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
              {label}
            </div>
          ))}
        </div>
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
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2}
        style={{ background: 'transparent' }}
      >
        <Background variant="dots" gap={22} size={1} color="rgba(255,255,255,0.04)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => ROLE_PALETTE[n.data?.role]?.dot ?? '#444'}
          maskColor="rgba(0,0,0,0.55)"
          style={{ width: 100, height: 60 }}
        />
        {/* Legend */}
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 10,
          background: 'rgba(6,6,18,0.85)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {[
            { color: '#00d4ff', label: 'Producer' },
            { color: '#ff6b35', label: 'Consumer' },
            { color: '#7c3aed', label: 'Both' },
            { color: '#555',    label: 'Inert' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'rgba(200,200,240,0.6)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              {label}
            </div>
          ))}
          <div style={{ marginTop: 3, fontSize: 9, color: 'rgba(200,200,240,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
            {data.nodes?.length ?? 0} files · {data.edges?.length ?? 0} deps
          </div>
        </div>
      </ReactFlow>
    </div>
  )
}
