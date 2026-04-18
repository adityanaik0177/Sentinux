# Nexus-Sentinel (Sentinux)

> **A self-healing, read-only architectural guardian for Python codebases.**

> 📦 **New here?** → [**Full Installation Guide (INSTALL.md)**](./INSTALL.md)

## ⚡ Core Invariant

**This tool CANNOT change a single line of user code.** Its value is purely in **Insight and Prevention** — surfacing architectural debt and calculating the *Blast Radius* of changes before they are committed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code Editor                          │
│                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────────┐  │
│  │   Pulse Sidebar       │◄───────►│  LSP Client (TypeScript) │  │
│  │   (React Webview)     │         └────────────┬─────────────┘  │
│  │                       │                      │ JSON-RPC/stdio  │
│  │  ┌─────────────────┐  │         ┌────────────▼─────────────┐  │
│  │  │ FreshnessMeter  │  │         │   LSP Brain (Python)     │  │
│  │  │ BlastRadius     │  │         │   pygls + tree-sitter    │  │
│  │  │ DependencyGraph │  │         │   ├── import_extractor   │  │
│  │  └─────────────────┘  │         │   ├── blast_radius       │  │
│  └──────────────────────┘         │   └── crawler (F-Score)  │  │
│                                    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │  Web Gate (Phase 2)  │
                              │  React + Supabase    │
                              │  GitHub OAuth + PAT  │
                              └─────────────────────┘
```

---

## 🚀 Phases — Status

| Phase | Name | Status | Stack |
|-------|------|--------|-------|
| **1** | The Core Brain | ✅ **Complete (40/40 tests)** | Python, `pygls`, `tree-sitter 0.25.2` |
| **2** | The Web Gate | ✅ **Complete** | React, Vite, Supabase Auth |
| **3** | The Pulse Sidebar | ✅ **Complete** | VS Code Extension API, React, Glassmorphism |
| **4** | Graph Intelligence | ✅ **Complete** | Python crawler, reactflow (`@xyflow/react`), F-Score |

---

## 📁 Project Structure

```
Sentinux2/
│
├── lsp-server/                      ← Phase 1: Python Brain
│   ├── server.py                      # pygls LSP server (stdio)
│   ├── requirements.txt               # tree-sitter 0.25.2, pygls 1.3.1
│   ├── test_phase1.py                 # 40-test smoke suite
│   ├── .venv/                         # Python virtual environment
│   └── analyzers/
│       ├── __init__.py
│       ├── import_extractor.py        # tree-sitter AST walker
│       ├── blast_radius.py            # Producer/Consumer + Diagnostics
│       └── crawler.py                 # Workspace F-Score crawler
│
├── web-gate/                        ← Phase 2: Auth Portal
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                    # 3-step flow: Login→Mode→PAT
│   │   ├── index.css                  # Deep-space glassmorphism
│   │   ├── lib/
│   │   │   ├── supabase.js            # Supabase client + GitHub OAuth
│   │   │   └── pat.js                 # PAT generation + storage
│   │   └── components/
│   │       ├── Login.jsx              # GitHub OAuth card
│   │       ├── ModeSelector.jsx       # Guardian / Autonomous cards
│   │       └── PatDisplay.jsx         # Token display + copy
│   ├── supabase-schema.sql            # DB schema for PAT table
│   ├── .env.example                   # Supabase credential template
│   └── package.json
│
└── vscode-extension/                ← Phase 3 & 4: VS Code Extension
    ├── src/
    │   ├── extension.ts               # Extension host entry
    │   └── panels/
    │       └── SidebarPanel.ts        # Webview provider + message bus
    ├── webview-ui/                    # React Pulse Dashboard
    │   ├── src/
    │   │   ├── main.jsx
    │   │   ├── App.jsx                # Tabs: Pulse | Graph
    │   │   ├── index.css              # Glassmorphic webview styles
    │   │   └── components/
    │   │       ├── FreshnessMeter.jsx # SVG radial F-Score gauge
    │   │       ├── BlastRadiusReport.jsx # Consumer list w/ pulse dots
    │   │       └── DependencyGraph.jsx   # @xyflow/react interactive map
    │   ├── index.html
    │   └── package.json
    ├── package.json                   # Extension manifest
    └── tsconfig.json
```

---

## 🛠 Getting Started

### 1. LSP Brain (Phase 1)

```powershell
cd lsp-server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Run smoke tests (expect 40/40 passed)
python test_phase1.py

# Start LSP server manually (VS Code starts it automatically)
python server.py
```

### 2. Web Gate (Phase 2)

```powershell
cd web-gate
cp .env.example .env          # Fill in your Supabase URL + anon key
# Run supabase-schema.sql in your Supabase SQL Editor
npm install
npm run dev                   # → http://localhost:5173
```

### 3. VS Code Extension (Phase 3 & 4)

```powershell
# Build the React webview first
cd vscode-extension/webview-ui
npm install
npm run build                 # → outputs to vscode-extension/dist/

# Compile the TypeScript extension host
cd vscode-extension
npm install
npm run compile               # → outputs JS to vscode-extension/out/

# To debug: open vscode-extension/ in VS Code and press F5
```

---

## 🔑 Key Technical Decisions

| Decision | Rationale |
|---|---|
| `tree-sitter 0.25.2` | Only version with a `cp314-win_amd64` pre-built wheel — no MSVC required |
| `QueryCursor.captures()` | New 0.25.x execution API replaces the old `Query.captures()` — returns `dict[str, list[Node]]` |
| `lsprotocol.types` | pygls 1.3.x moved all LSP types out of `pygls.lsp.types` into the separate `lsprotocol` package |
| `@xyflow/react` v12 | Reactflow renamed package — uses new hook-based API (`useNodesState`, `useEdgesState`) |
| Stdio transport | LSP Brain communicates via stdin/stdout JSON-RPC — zero network overhead, no port conflicts |
| Read-only invariant | The server only calls `publish_diagnostics()` — no workspace/applyEdit, no file writes |

---

## 🧪 F-Score Formula

```
F = (matched_signatures / total_dependencies) × 100

Where:
  total_dependencies = number of specifically named imports (from X import a, b)
  matched_signatures = number of those names still present in the producer's
                       defined_symbols list

Score interpretation:
  ≥ 85  →  Healthy  (contract intact, green)
  60–84 →  Drifting (some names removed/renamed, amber)
  < 60  →  Critical (significant contract break, red)
```

---

## ⚠️ Blast Radius Flow

```
User saves producer.py
       │
       ▼
didSave handler fires
       │
       ▼  tree-sitter re-parses file
DependencyGraph.update_file()
       │
       ▼  walks all known files
DependencyGraph.consumers_of(producer.py)
       │
       ▼  for each consumer found
BlastRadiusCalculator.calculate()
       │
       ▼  builds NST-001 Diagnostic
server.publish_diagnostics(consumer_uri, [diag])
       │
       ▼
VS Code Problems panel + Pulse Sidebar update
```
