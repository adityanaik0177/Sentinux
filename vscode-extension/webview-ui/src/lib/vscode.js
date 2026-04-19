/**
 * vscode.js — Singleton VS Code API accessor
 *
 * acquireVsCodeApi() may only be called ONCE per webview lifetime.
 * Import `vscode` and `navigateTo` from this module instead of calling
 * acquireVsCodeApi() directly in components.
 */

// Acquire once and freeze — subsequent calls would throw
const vscode = (() => {
  try {
    // eslint-disable-next-line no-undef
    return typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null
  } catch {
    return null
  }
})()

/**
 * Send a message to the VS Code extension host.
 */
export function postMessage(message) {
  vscode?.postMessage(message)
}

/**
 * Open a file in VS Code at a specific 1-based line number.
 * @param {string} file   - Absolute path to the file
 * @param {number} line   - 1-based line number (defaults to 1)
 */
export function navigateTo(file, line = 1) {
  if (!file) return
  vscode?.postMessage({ type: 'navigateTo', file, line })
}

export default vscode
