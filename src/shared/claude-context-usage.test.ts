import { describe, expect, it } from 'vitest'
import { claudeContextSeverity, parseClaudeContextUsage } from './claude-context-usage'

const post = (payload: unknown, paneKey: unknown = 'tab-1:leaf-1'): unknown => ({
  paneKey,
  payload: typeof payload === 'string' ? payload : JSON.stringify(payload)
})

describe('parseClaudeContextUsage', () => {
  it('reads the pane and the context percentage from a statusline post', () => {
    expect(parseClaudeContextUsage(post({ context_window: { used_percentage: 23.4 } }))).toEqual({
      paneKey: 'tab-1:leaf-1',
      usedPercent: 23.4
    })
  })

  it('clamps out-of-range values instead of showing a nonsense bar', () => {
    expect(
      parseClaudeContextUsage(post({ context_window: { used_percentage: 140 } }))?.usedPercent
    ).toBe(100)
    expect(
      parseClaudeContextUsage(post({ context_window: { used_percentage: -5 } }))?.usedPercent
    ).toBe(0)
  })

  it('ignores posts that cannot say which pane or how full it is', () => {
    expect(parseClaudeContextUsage(post({ context_window: { used_percentage: 5 } }, ''))).toBeNull()
    expect(
      parseClaudeContextUsage(post({ context_window: { used_percentage: 5 } }, 'x'.repeat(300)))
    ).toBeNull()
    expect(parseClaudeContextUsage(post({ context_window: {} }))).toBeNull()
    expect(parseClaudeContextUsage(post({ context_window: { used_percentage: 'NaN' } }))).toBeNull()
    expect(parseClaudeContextUsage(post({ rate_limits: {} }))).toBeNull()
    expect(parseClaudeContextUsage(post('not json'))).toBeNull()
    expect(parseClaudeContextUsage(null)).toBeNull()
  })
})

describe('claudeContextSeverity', () => {
  it('switches at 70% and 90%', () => {
    expect(claudeContextSeverity(69.9)).toBe('normal')
    expect(claudeContextSeverity(70)).toBe('warn')
    expect(claudeContextSeverity(89.9)).toBe('warn')
    expect(claudeContextSeverity(90)).toBe('critical')
  })
})
