import { useState, useRef, useEffect } from 'react'
import { X, ScrollText, ShieldCheck, AlertTriangle } from 'lucide-react'

const SECTIONS = [
  {
    icon: '🛡️',
    title: '1. Nature of the Service',
    body: `Nexus-Sentinel ("the Service") is a read-only architectural analysis tool for software projects. It analyses dependency graphs, detects structural code smells, and surfaces diagnostic information directly inside your code editor via a Language Server Protocol (LSP) extension.

The Service NEVER modifies, writes to, patches, or deletes any file in your workspace. All output is strictly advisory — LSP diagnostic payloads and sidebar visualisations.`,
  },
  {
    icon: '🔐',
    title: '2. Authentication & Data Collection',
    body: `We use GitHub OAuth exclusively to authenticate you. We do not store your GitHub password or private repository contents.

Upon login we collect and store:
  • Your GitHub username and public profile information
  • A hashed Personal Access Token (PAT) we issue to you
  • Your selected operating mode (Guardian or Autonomous)

We do NOT collect, store, or transmit your source code files, commit history, or private repository data.`,
  },
  {
    icon: '🤖',
    title: '3. AI-Powered Features',
    body: `The Service uses Google Gemini AI models to generate architectural suggestions, detect duplicate code patterns, and analyse dead code. Function bodies from your workspace may be sent to Google's API for embedding and analysis.

By using the Service you consent to this processing. Refer to Google's Privacy Policy for details on how they handle API input data. We do not retain your code snippets beyond the duration of a single analysis session.`,
  },
  {
    icon: '📦',
    title: '4. Third-Party Services',
    body: `The Service integrates with:
  • Supabase (database and authentication infrastructure)
  • Google Gemini API (AI analysis and embeddings)
  • GitHub OAuth (identity verification)

Each third-party service is governed by its own terms and privacy policy. We are not responsible for the availability, accuracy, or data practices of these services.`,
  },
  {
    icon: '⚠️',
    title: '5. Disclaimer of Warranties',
    body: `THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. We make no guarantees that:
  • Architectural suggestions are accurate or complete
  • Dead code and duplicate detection results are exhaustive
  • The Service will be available without interruption

All AI-generated suggestions are advisory only. You are solely responsible for any code changes you make based on the Service's output.`,
  },
  {
    icon: '📋',
    title: '6. Acceptable Use',
    body: `You agree not to:
  • Attempt to reverse-engineer, bypass, or exploit the authentication system
  • Use the Service to analyse codebases you do not own or have explicit permission to analyse
  • Share your Personal Access Token with unauthorised third parties
  • Use automated scripts to abuse the PAT issuance system

Violation of these terms may result in immediate revocation of your access token.`,
  },
  {
    icon: '🔄',
    title: '7. Changes to These Terms',
    body: `We reserve the right to update these Terms & Conditions at any time. Continued use of the Service after changes are posted constitutes acceptance of the revised terms. We will make reasonable efforts to notify active users of material changes via the web gate.`,
  },
  {
    icon: '📮',
    title: '8. Contact',
    body: `For questions about these terms or to report a security issue, open an issue on the official GitHub repository:
github.com/adityanaik0177/Sentinux

Last updated: April 2026`,
  },
]

export default function TermsModal({ onAccept, onDecline }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [checked, setChecked] = useState(false)
  const bodyRef = useRef(null)

  const handleScroll = () => {
    const el = bodyRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40
    if (atBottom) setScrolledToBottom(true)
  }

  // Allow agreement if they scrolled to bottom AND checked the box
  const canAccept = scrolledToBottom && checked

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 600,
        maxHeight: '90vh',
        background: 'rgba(14,14,30,0.97)',
        border: '1px solid rgba(0,212,255,0.2)',
        borderRadius: 16,
        boxShadow: '0 0 60px rgba(0,212,255,0.08), 0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(0,212,255,0.04)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(124,58,237,0.2))',
            border: '1px solid rgba(0,212,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ScrollText size={18} color="var(--neon-cyan, #00d4ff)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#f0f0ff', margin: 0 }}>
              Terms &amp; Conditions
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'rgba(180,180,220,0.55)', margin: 0 }}>
              Nexus-Sentinel · Please read before continuing
            </p>
          </div>
          <button onClick={onDecline} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(180,180,220,0.4)', padding: 4, borderRadius: 6,
            transition: 'color 0.2s',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div
          ref={bodyRef}
          onScroll={handleScroll}
          style={{
            overflowY: 'auto', flex: 1,
            padding: '1.5rem',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,212,255,0.2) transparent',
          }}
        >
          {/* Read prompt */}
          {!scrolledToBottom && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,200,0,0.06)',
              border: '1px solid rgba(255,200,0,0.2)',
              borderRadius: 8, padding: '8px 12px',
              marginBottom: '1.25rem', fontSize: '0.76rem',
              color: 'rgba(255,200,0,0.8)',
            }}>
              <AlertTriangle size={13} />
              Scroll to the bottom to accept
            </div>
          )}

          {SECTIONS.map((s) => (
            <div key={s.title} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                <h3 style={{
                  fontSize: '0.85rem', fontWeight: 700,
                  color: '#c8e0ff', margin: 0,
                }}>{s.title}</h3>
              </div>
              <p style={{
                fontSize: '0.78rem',
                color: 'rgba(180,180,220,0.65)',
                lineHeight: 1.75,
                whiteSpace: 'pre-line',
                margin: 0,
                paddingLeft: '1.75rem',
              }}>{s.body}</p>
            </div>
          ))}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '1rem 0' }} />

          {/* Checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: 'pointer', padding: '0.75rem',
            background: checked ? 'rgba(0,255,170,0.05)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${checked ? 'rgba(0,255,170,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10,
            transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              disabled={!scrolledToBottom}
              style={{ marginTop: 2, accentColor: '#00ffaa', cursor: scrolledToBottom ? 'pointer' : 'not-allowed' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'rgba(200,220,200,0.8)', lineHeight: 1.6 }}>
              I have read and agree to the Nexus-Sentinel Terms &amp; Conditions. I understand this tool is{' '}
              <strong style={{ color: '#00ffaa' }}>read-only</strong> and will never modify my source code.
            </span>
          </label>
        </div>

        {/* ── Footer buttons ── */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', gap: 10,
          flexShrink: 0,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <button
            onClick={onDecline}
            style={{
              flex: 1, padding: '10px 0',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, cursor: 'pointer',
              color: 'rgba(180,180,220,0.6)',
              fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            Decline
          </button>
          <button
            onClick={canAccept ? onAccept : undefined}
            disabled={!canAccept}
            style={{
              flex: 2, padding: '10px 0',
              background: canAccept
                ? 'linear-gradient(135deg,#00d4ff,#7c3aed)'
                : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 8,
              cursor: canAccept ? 'pointer' : 'not-allowed',
              color: canAccept ? '#fff' : 'rgba(180,180,220,0.3)',
              fontSize: '0.85rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.3s',
              boxShadow: canAccept ? '0 0 20px rgba(0,212,255,0.25)' : 'none',
            }}
          >
            <ShieldCheck size={16} />
            I Agree — Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  )
}
