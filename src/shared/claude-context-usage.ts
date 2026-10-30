/** Per-pane Claude context-window usage, read from the same statusline posts that carry usage limits. */

export const CLAUDE_CONTEXT_USAGE_CHANNEL = 'rateLimits:claudeContext'

export type ClaudeContextUsage = {
  paneKey: string
  /** 0-100 share of the context window in use. */
  usedPercent: number
}

export type ClaudeContextSeverity = 'normal' | 'warn' | 'critical'

const MAX_PANE_KEY_LENGTH = 256
const WARN_PERCENT = 70
const CRITICAL_PERCENT = 90

export function claudeContextSeverity(usedPercent: number): ClaudeContextSeverity {
  if (usedPercent >= CRITICAL_PERCENT) {
    return 'critical'
  }
  return usedPercent >= WARN_PERCENT ? 'warn' : 'normal'
}

/** Null unless the post names its pane and carries a finite context percentage. */
export function parseClaudeContextUsage(body: unknown): ClaudeContextUsage | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const fields = body as { payload?: unknown; paneKey?: unknown }
  const paneKey = typeof fields.paneKey === 'string' ? fields.paneKey.trim() : ''
  if (!paneKey || paneKey.length > MAX_PANE_KEY_LENGTH || typeof fields.payload !== 'string') {
    return null
  }
  let payload: unknown
  try {
    payload = JSON.parse(fields.payload)
  } catch {
    return null
  }
  const contextWindow =
    typeof payload === 'object' && payload !== null
      ? (payload as { context_window?: unknown }).context_window
      : null
  const used =
    typeof contextWindow === 'object' && contextWindow !== null
      ? (contextWindow as { used_percentage?: unknown }).used_percentage
      : null
  if (typeof used !== 'number' || !Number.isFinite(used)) {
    return null
  }
  return { paneKey, usedPercent: Math.min(100, Math.max(0, used)) }
}
