import { describe, expect, it, vi } from 'vitest'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { buildProviderUsageCards, formatResetDuration } from './UsageAccountStrip'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/hooks/useResetCountdownClock', () => ({ useResetCountdownClock: () => 0 }))
vi.mock('../../store', () => ({ useAppStore: () => null }))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))

function limits(usedPercent: number): ProviderRateLimits {
  return {
    provider: 'claude',
    session: { usedPercent, windowMinutes: 300, resetsAt: null, resetDescription: null },
    weekly: null,
    updatedAt: 0,
    error: null,
    status: 'ok'
  }
}

const accounts = [
  { id: 'a', email: 'a@example.com' },
  { id: 'b', email: 'b@example.com' }
]

describe('buildProviderUsageCards', () => {
  it('gives the active account live limits and the other its inactive snapshot', () => {
    const inactive: InactiveAccountUsage[] = [
      { accountId: 'b', rateLimits: limits(40), updatedAt: 1, isFetching: true }
    ]
    const cards = buildProviderUsageCards('claude', accounts, 'a', limits(10), inactive)

    expect(
      cards.map((card) => [card.email, card.active, card.limits?.session?.usedPercent])
    ).toEqual([
      ['a@example.com', true, 10],
      ['b@example.com', false, 40]
    ])
    expect(cards[1].isFetching).toBe(true)
  })

  it('leaves an inactive account empty until its usage has been fetched', () => {
    const [, second] = buildProviderUsageCards('claude', accounts, 'a', limits(10), [])
    expect(second.limits).toBeNull()
  })

  it('adds a system-default card when no managed account is selected', () => {
    const cards = buildProviderUsageCards('codex', [], null, limits(5), [])
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ email: null, active: true })
  })

  it('shows nothing for a provider with no accounts and no live usage', () => {
    expect(buildProviderUsageCards('codex', [], null, null, [])).toEqual([])
  })
})

describe('formatResetDuration', () => {
  it('drops the smallest unit once a day or more remains', () => {
    expect(formatResetDuration(5 * 86_400_000 + 20 * 3_600_000 + 7 * 60_000)).toBe('5d 20h')
    expect(formatResetDuration(65 * 60_000)).toBe('1h 5m')
    expect(formatResetDuration(35 * 60_000)).toBe('35m')
  })
})
