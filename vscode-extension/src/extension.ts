/**
 * extension.ts — Nexus-Sentinel VS Code Extension Host
 * ======================================================
 * Entry point for the VS Code extension. Responsibilities:
 *   1. Launch the Python LSP Brain as a child process
 *   2. Wire up the vscode-languageclient LanguageClient
 *   3. Register the Pulse Sidebar WebviewViewProvider
 *   4. Route LSP custom command results to the Webview
 *
 * READ-ONLY GUARANTEE: This extension never writes to user source files.
 */

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { SidebarPanel } from './panels/SidebarPanel'

let client: LanguageClient | undefined
let sidebarProvider: SidebarPanel | undefined

// ── Activate ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const log = vscode.window.createOutputChannel('Nexus-Sentinel')
  log.appendLine('[Nexus-Sentinel] Activating…')

  // ── 1. Resolve Python LSP server path ─────────────────────────────────────
  const config = vscode.workspace.getConfiguration('nexusSentinel')
  let serverPath: string = config.get<string>('serverPath') ?? ''
  const pythonPath: string = config.get<string>('pythonPath') ?? 'python'

  if (!serverPath) {
    // Default: look relative to the extension's install location
    const candidate = path.join(context.extensionPath, '..', 'lsp-server', 'server.py')
    if (fs.existsSync(candidate)) {
      serverPath = candidate
    } else {
      vscode.window.showWarningMessage(
        '[Nexus-Sentinel] Could not find server.py. Set nexusSentinel.serverPath in settings.'
      )
    }
  }

  // ── 2. Start the Python LSP Brain ─────────────────────────────────────────
  if (serverPath) {
    const serverOptions: ServerOptions = {
      command: pythonPath,
      args: [serverPath],
      transport: TransportKind.stdio,
    }

    const clientOptions: LanguageClientOptions = {
      // Activate for Python files only
      documentSelector: [{ scheme: 'file', language: 'python' }],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher('**/*.py'),
      },
      outputChannel: log,
    }

    client = new LanguageClient(
      'nexusSentinel',
      'Nexus-Sentinel LSP Brain',
      serverOptions,
      clientOptions
    )

    client.start().then(() => {
      log.appendLine('[Nexus-Sentinel] LSP Brain connected.')
    }).catch((err: Error) => {
      log.appendLine(`[Nexus-Sentinel] LSP Brain failed to start: ${err.message}`)
      vscode.window.showErrorMessage(`Nexus-Sentinel: LSP Brain failed — ${err.message}`)
    })
  }

  // ── 3. Register Pulse Sidebar ─────────────────────────────────────────────
  sidebarProvider = new SidebarPanel(context.extensionUri, client)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarPanel.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  )

  // ── 4. Register Commands ──────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('nexusSentinel.startServer', () => {
      if (client) {
        vscode.window.showInformationMessage('Nexus-Sentinel LSP Brain is already running.')
      } else {
        vscode.window.showWarningMessage('Set nexusSentinel.serverPath and reload the window.')
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('nexusSentinel.showBlastRadius', async () => {
      const activeUri = vscode.window.activeTextEditor?.document.uri.toString()
      if (!activeUri || !client) return

      try {
        const report = await client.sendRequest('workspace/executeCommand', {
          command: 'nexusSentinel/getBlastRadiusReport',
          arguments: [activeUri],
        })
        sidebarProvider?.postMessage({ type: 'blastRadiusReport', payload: report })
      } catch (err: any) {
        log.appendLine(`[Nexus-Sentinel] Blast radius command failed: ${err.message}`)
      }
    })
  )

  // ── 5. Auto-push graph on save ────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== 'python' || !client) return

      // Short delay to let the LSP server index the file
      await new Promise<void>((r) => setTimeout(r, 300))

      try {
        const report = await client.sendRequest('workspace/executeCommand', {
          command: 'nexusSentinel/getBlastRadiusReport',
          arguments: [doc.uri.toString()],
        })
        sidebarProvider?.postMessage({ type: 'blastRadiusReport', payload: report })
      } catch {
        // Silently ignore — server may not be ready yet
      }
    })
  )

  // ── 6. Refresh Pulse when switching Python file tabs ──────────────────────
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (!editor || editor.document.languageId !== 'python' || !client) return
      // Small delay so LSP has time to index the newly focused file
      await new Promise<void>((r) => setTimeout(r, 400))
      try {
        const report = await client.sendRequest('workspace/executeCommand', {
          command: 'nexusSentinel/getBlastRadiusReport',
          arguments: [editor.document.uri.toString()],
        })
        sidebarProvider?.postMessage({ type: 'blastRadiusReport', payload: report })
      } catch {
        // Ignore if LSP not yet ready
      }
    })
  )

  log.appendLine('[Nexus-Sentinel] Extension activated.')
}

// ── Deactivate ────────────────────────────────────────────────────────────────

export function deactivate(): Thenable<void> | undefined {
  return client?.stop()
}
