import { describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { ProviderRateLimits, RateLimitWindow } from '../../../shared/rate-limit-types'

vi.mock('../store', () => ({ useAppStore: { getState: () => ({}), subscribe: () => () => {} } }))
vi.mock('sonner', () => ({ toast: { success: () => {} } }))

import {
  effectiveTabAccountId,
  findLimitReached,
  managedAccountsFor,
  peakUsedPercent,
  tabAccountLimits
} from './terminal-tab-account'

const window = (usedPercent: number, resetsAt: number | null = 1): RateLimitWindow => ({
  usedPercent,
  windowMinutes: 300,
  resetsAt,
  resetDescription: null
})
const limits = (session: number | null, weekly: number | null): ProviderRateLimits =>
  ({
    session: session === null ? null : window(session),
    weekly: weekly === null ? null : window(weekly)
  }) as ProviderRateLimits

const settings = (overrides: Partial<GlobalSettings>): GlobalSettings =>
  ({
    claudeManagedAccounts: [
      { id: 'a', email: 'a@example.test' },
      { id: 'w', email: 'w@example.test', managedAuthRuntime: 'wsl' }
    ],
    activeClaudeManagedAccountId: 'a',
    codexManagedAccounts: [],
    activeCodexManagedAccountId: null,
    ...overrides
  }) as GlobalSettings

describe('findLimitReached', () => {
  it('fires when either window reaches 95%, reporting the fuller one', () => {
    expect(findLimitReached(limits(94, 94))).toBeNull()
    expect(findLimitReached(limits(95, 10))?.window).toBe('session')
    expect(findLimitReached(limits(10, 96))?.window).toBe('weekly')
    expect(findLimitReached(limits(97, 99))?.window).toBe('weekly')
  })

  it('stays quiet while usage is unknown', () => {
    expect(findLimitReached(null)).toBeNull()
    expect(findLimitReached(limits(null, null))).toBeNull()
  })
})

describe('peakUsedPercent', () => {
  it('ranks unknown usage after any known usage', () => {
    expect(peakUsedPercent(limits(20, 70))).toBe(70)
    expect(peakUsedPercent(null)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('effectiveTabAccountId', () => {
  it('prefers the tab pin, including an explicit System default, over the global account', () => {
    const s = settings({})
    expect(effectiveTabAccountId(s, undefined, 'claude')).toBe('a')
    expect(effectiveTabAccountId(s, { claudeAccountId: 'b' }, 'claude')).toBe('b')
    expect(effectiveTabAccountId(s, { claudeAccountId: null }, 'claude')).toBeNull()
    expect(effectiveTabAccountId(s, { codexAccountId: 'x' }, 'claude')).toBe('a')
  })
})

describe('managedAccountsFor', () => {
  it('leaves out WSL accounts a pin cannot reach', () => {
    expect(managedAccountsFor(settings({}), 'claude').map((a) => a.id)).toEqual(['a'])
  })
})

describe('tabAccountLimits', () => {
  it('uses the live snapshot for the global account and the polled copy for others', () => {
    const live = limits(1, 2)
    const polled = limits(50, 60)
    const base = {
      settings: settings({}),
      provider: 'claude' as const,
      activeLimits: live,
      inactive: [{ accountId: 'b', rateLimits: polled }] as never
    }
    expect(tabAccountLimits({ ...base, accountId: 'a' })).toBe(live)
    expect(tabAccountLimits({ ...base, accountId: 'b' })).toBe(polled)
    expect(tabAccountLimits({ ...base, accountId: null })).toBeNull()
  })
})
