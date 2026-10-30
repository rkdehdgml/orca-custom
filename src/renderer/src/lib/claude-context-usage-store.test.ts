import { afterEach, describe, expect, it } from 'vitest'
import {
  getClaudeContextReadings,
  recordClaudeContextUsage,
  resetClaudeContextUsageForTests,
  selectTabContext
} from './claude-context-usage-store'

afterEach(resetClaudeContextUsageForTests)

const reading = (usedPercent: number, at: number) => ({ usedPercent, at })

describe('selectTabContext', () => {
  it('uses the fullest pane of the tab and ignores other tabs', () => {
    const all = new Map([
      ['t1:a', reading(20, 1000)],
      ['t1:b', reading(55, 1000)],
      ['t10:a', reading(99, 1000)]
    ])
    expect(selectTabContext(all, 't1', 1000)).toEqual({ usedPercent: 55, stale: false })
    expect(selectTabContext(all, 't2', 1000)).toBeNull()
  })

  it('marks a reading stale after a minute without updates', () => {
    const all = new Map([['t1:a', reading(20, 0)]])
    expect(selectTabContext(all, 't1', 60_000)?.stale).toBe(false)
    expect(selectTabContext(all, 't1', 60_001)?.stale).toBe(true)
  })
})

describe('recordClaudeContextUsage', () => {
  it('replaces a pane reading and drops panes that went quiet over an hour ago', () => {
    const hour = 60 * 60_000
    recordClaudeContextUsage({ paneKey: 't1:a', usedPercent: 10 }, 0)
    recordClaudeContextUsage({ paneKey: 't2:a', usedPercent: 30 }, hour + 1)
    recordClaudeContextUsage({ paneKey: 't2:a', usedPercent: 40 }, hour + 2)
    expect([...getClaudeContextReadings()]).toEqual([['t2:a', { usedPercent: 40, at: hour + 2 }]])
  })
})
