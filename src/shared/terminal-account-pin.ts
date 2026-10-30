/** A terminal's own Claude/Codex account. A missing key follows the global selection; null pins System default. */
export type TerminalAccountPin = {
  claudeAccountId?: string | null
  codexAccountId?: string | null
}

const MAX_ACCOUNT_ID_LENGTH = 256

function normalizeAccountId(value: unknown): string | null | undefined {
  if (value === null) {
    return null
  }
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ACCOUNT_ID_LENGTH
    ? value
    : undefined
}

/** Drop anything that is not a well-formed pin so a bad payload can never route a terminal to another account. */
export function normalizeTerminalAccountPin(value: unknown): TerminalAccountPin | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const record = value as Record<string, unknown> // SAFETY: shape is checked field by field below.
  const claudeAccountId = normalizeAccountId(record.claudeAccountId)
  const codexAccountId = normalizeAccountId(record.codexAccountId)
  if (claudeAccountId === undefined && codexAccountId === undefined) {
    return undefined
  }
  return {
    ...(claudeAccountId !== undefined ? { claudeAccountId } : {}),
    ...(codexAccountId !== undefined ? { codexAccountId } : {})
  }
}
