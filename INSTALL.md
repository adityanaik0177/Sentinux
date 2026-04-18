# Nexus-Sentinel — Installation & Setup Guide

> A complete step-by-step guide for getting Nexus-Sentinel running on your machine.
> Estimated time: **15–20 minutes**

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Minimum Version | Check With |
|------|----------------|------------|
| **Python** | 3.10+ | `python --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **VS Code** | 1.85+ | Help → About |
| **Git** | Any | `git --version` |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/nexus-sentinel.git
cd nexus-sentinel
```

---

## Step 2 — Set Up the Python LSP Brain

The LSP Brain is the core analysis engine. It uses `tree-sitter` to parse
Python files and calculate Blast Radius + Freshness scores.

```bash
cd lsp-server

# Create and activate a virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# On macOS / Linux:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Verify it works

```bash
python test_phase1.py
```

You should see:

```
Ran 40 tests in X.XXXs
OK
```

> **Note:** This project uses `tree-sitter 0.25.2` specifically — it is the only
> version with pre-built wheels for Windows (`cp314-win_amd64`), so no C compiler
> is required. Do not upgrade it.

---

## Step 3 — Set Up the VS Code Extension

The extension consists of two parts:
1. A **React webview** (the Pulse Dashboard sidebar)
2. A **TypeScript extension host** (communicates with the LSP Brain)

### 3a — Build the React Webview

```bash
cd vscode-extension/webview-ui
npm install
npm run build
```

This outputs the built assets to `vscode-extension/dist/`.

### 3b — Compile the TypeScript Extension Host

```bash
cd vscode-extension
npm install
npm run compile
```

This outputs compiled JS to `vscode-extension/out/`.

---

## Step 4 — Launch the Extension in VS Code

1. Open VS Code
2. **File → Open Folder** → Select the `vscode-extension/` folder
3. Press **F5** → A new **Extension Development Host** window opens
4. In the new window, **File → Open Folder** → Select any Python project you
   want to analyse (or use the included `test-workspace/`)

### Configure the Extension Settings

In the Extension Development Host window:

1. Open **Settings** (`Ctrl+,`)
2. Search for **"Nexus Sentinel"**
3. Fill in:

   | Setting | Value |
   |---------|-------|
   | **Server Path** | Absolute path to `lsp-server/server.py` |
   | **Python Path** | Absolute path to `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python` (macOS/Linux) |
   | **Pat** | Leave empty for now (filled in Step 6) |

   **Windows example:**
   ```
   Server Path:  C:\path\to\nexus-sentinel\lsp-server\server.py
   Python Path:  C:\path\to\nexus-sentinel\lsp-server\.venv\Scripts\python.exe
   ```

   **macOS/Linux example:**
   ```
   Server Path:  /home/you/nexus-sentinel/lsp-server/server.py
   Python Path:  /home/you/nexus-sentinel/lsp-server/.venv/bin/python
   ```

4. Reload the window: `Ctrl+Shift+P` → **Developer: Reload Window**

### Verify the extension is running

- Click the **shield icon** in the Activity Bar (left sidebar)
- The **Nexus-Sentinel Pulse Dashboard** should open
- The header should show **● Brain Connected**
- Check `View → Output → Nexus-Sentinel` for logs

---

## Step 5 — Set Up the Web Gate (Auth Portal)

The Web Gate is a React + Vite web app that handles GitHub OAuth login
and issues Personal Access Tokens (PATs) for the VS Code extension.

### 5a — Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a **New Project**
3. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key**

### 5b — Apply the Database Schema

In your Supabase project:
1. Go to **SQL Editor**
2. Paste the entire contents of `web-gate/supabase-schema.sql`
3. Click **Run**

### 5c — Create a GitHub OAuth App

1. Go to [https://github.com/settings/developers](https://github.com/settings/developers)
2. Click **OAuth Apps → New OAuth App**
3. Fill in:
   - **Application name:** `Nexus-Sentinel`
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:**
     ```
     https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback
     ```
     *(Replace `YOUR-PROJECT-ID` with your Supabase project ID)*
4. Click **Register application**
5. Copy the **Client ID** and click **Generate a new client secret**

### 5d — Connect GitHub OAuth to Supabase

1. In Supabase Dashboard → **Authentication → Providers → GitHub**
2. Toggle **Enable GitHub Provider**
3. Paste your GitHub **Client ID** and **Client Secret**
4. Save

5. Go to **Authentication → URL Configuration**
6. Add `http://localhost:5173` to **Redirect URLs**

### 5e — Configure Environment Variables

```bash
cd web-gate
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5f — Start the Web Gate

```bash
cd web-gate
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Step 6 — Get Your Personal Access Token (PAT)

1. Open [http://localhost:5173](http://localhost:5173)
2. Click **Continue with GitHub** → Authorise the app
3. Select your mode:
   - **Guardian** — Read-only, surfaces warnings (recommended)
   - **Autonomous** — Extended analysis features
4. Your PAT is generated and displayed in the format `NST-xxxxxxxx...`
5. Click **Copy**

### Paste the PAT into VS Code

1. In the Extension Development Host window → **Settings** (`Ctrl+,`)
2. Search for **"Nexus Sentinel"**
3. Paste the PAT into the **Pat** field
4. Reload: `Ctrl+Shift+P` → **Developer: Reload Window**

The sidebar badge will now show your mode (e.g., **👁 Guardian**).

---

## Step 7 — Test With the Sample Workspace

The repo includes a `test-workspace/` folder designed to demonstrate all
extension features. Open it in the Extension Development Host:

**File → Open Folder → `test-workspace/`**

| File | Expected F-Score | What it tests |
|------|-----------------|---------------|
| `database.py` | 🟢 100% | Pure producer — triggers blast radius on save |
| `api.py` | 🟢 100% | Healthy consumer |
| `reports.py` | 🟡 67% | Drifting — 2 imported names no longer exist |
| `notifications.py` | 🔴 12.5% | Critical — most imports are broken |

### Test Blast Radius

1. Open `database.py`
2. Press **Ctrl+S** (save)
3. Check **View → Problems** — you should see ⚡ Blast Radius warnings appear
   in `api.py`, `models.py`, `reports.py`, and `notifications.py`

### Test the Dependency Graph

1. Click the **Graph** tab in the Pulse Dashboard
2. The workspace dependency map will render with 7 nodes and 10 edges
3. Drag nodes to rearrange — scroll to zoom — use the MiniMap to navigate

---

## Troubleshooting

### "LSP Brain failed to start"

- Verify the **Server Path** and **Python Path** in settings are absolute paths
- Confirm the `.venv` is activated and `requirements.txt` was installed inside it
- Check `View → Output → Nexus-Sentinel` for the exact error

### Dashboard sidebar is blank

- Make sure you ran `npm run build` in `vscode-extension/webview-ui/` **before** pressing F5
- Reload the window: `Ctrl+Shift+P` → **Developer: Reload Window**

### GitHub OAuth redirects to a blank page

- Double-check the **Authorization callback URL** in your GitHub OAuth App matches
  your Supabase project URL exactly
- Make sure `http://localhost:5173` is in Supabase **Redirect URLs**

### `tree-sitter` install fails on Windows

- Make sure you are using `tree-sitter==0.25.2` exactly (pinned in `requirements.txt`)
- This version has a pre-built wheel — no Visual Studio Build Tools required
- If using a different Python version, try Python 3.10, 3.11, or 3.12

### F-Score always shows 100%

- The LSP Brain needs to index all files in the workspace first
- Open multiple `.py` files in the project, or save one — this triggers indexing
- The startup crawl runs automatically when you open a folder

---

## Architecture Overview

```
nexus-sentinel/
│
├── lsp-server/          ← Python Brain (pygls + tree-sitter)
│   ├── server.py          # LSP server (stdio transport)
│   ├── requirements.txt   # Python dependencies
│   └── analyzers/
│       ├── import_extractor.py   # AST import walker
│       ├── blast_radius.py       # Producer/Consumer graph
│       └── crawler.py            # F-Score calculator
│
├── web-gate/            ← Auth Portal (React + Supabase)
│   ├── src/
│   │   ├── components/    # Login, ModeSelector, PatDisplay
│   │   └── lib/           # supabase.js, pat.js
│   ├── supabase-schema.sql
│   └── .env.example       # ← Copy to .env and fill in
│
├── vscode-extension/    ← VS Code Extension
│   ├── src/
│   │   ├── extension.ts       # Extension entry point
│   │   └── panels/
│   │       └── SidebarPanel.ts  # Webview provider
│   └── webview-ui/
│       └── src/
│           ├── App.jsx
│           └── components/
│               ├── FreshnessMeter.jsx
│               ├── BlastRadiusReport.jsx
│               └── DependencyGraph.jsx
│
└── test-workspace/      ← Sample Python project for testing
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Never commit `.env` files or the `.venv/` folder (`.gitignore` handles this)
4. Open a Pull Request

---

## License

MIT — free to use, modify, and distribute.
This tool **never modifies your source code**. Read-only. Always watching. 👁
