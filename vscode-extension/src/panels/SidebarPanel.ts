/**
 * SidebarPanel.ts — Nexus-Sentinel Pulse Dashboard Webview
 * ==========================================================
 * Manages the VS Code WebviewView that hosts the React Pulse Dashboard.
 *
 * Message protocol (Host ↔ Webview):
 *
 *  Host → Webview:
 *    { type: 'blastRadiusReport', payload: BlastRadiusReport }
 *    { type: 'workspaceGraph',    payload: WorkspaceGraph    }
 *    { type: 'init',              payload: { mode, pat }     }
 *
 *  Webview → Host:
 *    { type: 'requestGraph' }
 *    { type: 'requestBlastRadius', uri: string }
 *    { type: 'ready' }
 */

import * as vscode from 'vscode'
import * as path from 'path'
import type { LanguageClient } from 'vscode-languageclient/node'

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'nexusSentinel.pulseView'

  private _view?: vscode.WebviewView
  private _client?: LanguageClient

  constructor(
    private readonly _extensionUri: vscode.Uri,
    client?: LanguageClient
  ) {
    this._client = client
  }

  // ── WebviewViewProvider ───────────────────────────────────────────────────

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist'),
      ],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    // Handle messages from the React webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready': {
          // Push config on webview load
          const config = vscode.workspace.getConfiguration('nexusSentinel')
          this.postMessage({
            type: 'init',
            payload: { mode: 'guardian', pat: config.get<string>('pat') ?? '' },
          })
          break
        }

        case 'requestActiveFilePulse': {
          // Push blast radius for whatever Python file is currently active
          const activeDoc = vscode.window.activeTextEditor?.document
          if (!this._client || !activeDoc || activeDoc.languageId !== 'python') return
          try {
            const report = await this._client.sendRequest('workspace/executeCommand', {
              command: 'nexusSentinel/getBlastRadiusReport',
              arguments: [activeDoc.uri.toString()],
            })
            this.postMessage({ type: 'blastRadiusReport', payload: report })
          } catch {
            // LSP may not be ready yet — ignore
          }
          break
        }

        case 'requestGraph': {
          if (!this._client) return
          try {
            const graph = await this._client.sendRequest('workspace/executeCommand', {
              command: 'nexusSentinel/getWorkspaceGraph',
              arguments: [],
            })
            this.postMessage({ type: 'workspaceGraph', payload: graph })
          } catch (err: any) {
            this.postMessage({ type: 'error', message: err.message })
          }
          break
        }

        case 'requestBlastRadius': {
          if (!this._client || !message.uri) return
          try {
            const report = await this._client.sendRequest('workspace/executeCommand', {
              command: 'nexusSentinel/getBlastRadiusReport',
              arguments: [message.uri],
            })
            this.postMessage({ type: 'blastRadiusReport', payload: report })
          } catch (err: any) {
            this.postMessage({ type: 'error', message: err.message })
          }
          break
        }
      }
    })
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Send a message to the React webview */
  public postMessage(message: object) {
    this._view?.webview.postMessage(message)
  }

  // ── HTML Generation ───────────────────────────────────────────────────────

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this._extensionUri, 'dist')

    // In production: load the Vite-built bundle
    // In development: load from vite dev server (switch the src below)
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, 'assets', 'index.css')
    )
    const nonce = getNonce()

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
            style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com;
            font-src https://fonts.gstatic.com;
            script-src 'nonce-${nonce}';
            img-src ${webview.cspSource} data:;" />
        <link rel="stylesheet" href="${styleUri}" />
        <title>Nexus-Sentinel Pulse</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNonce(): string {
  let text = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}
