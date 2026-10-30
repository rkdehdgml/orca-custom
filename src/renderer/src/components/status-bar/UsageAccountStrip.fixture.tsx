import type { CSSProperties } from 'react'
import type {
  ClaudeManagedAccount,
  CodexManagedAccount
} from '../../../../shared/managed-account-types'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { getDefaultSettings } from '../../../../shared/constants'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { UsageAccountStrip } from './UsageAccountStrip'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

function limits(
  provider: 'claude' | 'codex',
  sessionPercent: number,
  weeklyPercent: number
): ProviderRateLimits {
  const now = Date.now()
  return {
    provider,
    session: {
      usedPercent: sessionPercent,
      windowMinutes: 300,
      resetsAt: now + 3 * HOUR_MS + 37 * MINUTE_MS,
      resetDescription: null
    },
    weekly: {
      usedPercent: weeklyPercent,
      windowMinutes: 10080,
      resetsAt: now + 2 * 24 * HOUR_MS + 5 * MINUTE_MS,
      resetDescription: null
    },
    updatedAt: now,
    error: null,
    status: 'ok'
  }
}

function claudeAccount(id: string, email: string): ClaudeManagedAccount {
  return {
    id,
    email,
    managedAuthPath: `C:\\fixture\\${id}`,
    authMethod: 'subscription-oauth',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

function codexAccount(id: string, email: string): CodexManagedAccount {
  return {
    id,
    email,
    managedHomePath: `C:\\fixture\\${id}`,
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  }
}

function storeFor(options: {
  claude: ClaudeManagedAccount[]
  codex: CodexManagedAccount[]
  activeClaudeId: string | null
  activeCodexId: string | null
  rateLimits: Parameters<typeof createEmptyRateLimitState>[0]
}): Record<string, unknown> {
  return {
    settings: {
      ...getDefaultSettings('C:\\Users\\fixture'),
      claudeManagedAccounts: options.claude,
      activeClaudeManagedAccountId: options.activeClaudeId,
      codexManagedAccounts: options.codex,
      activeCodexManagedAccountId: options.activeCodexId
    },
    rateLimits: createEmptyRateLimitState(options.rateLimits)
  }
}

// Reserve the same right-edge gutter the Windows window controls overlay.
function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col" style={{ '--window-controls-width': '138px' } as CSSProperties}>
      {children}
    </div>
  )
}

export const threeAccounts = defineFixture({
  width: 1280,
  store: storeFor({
    claude: [claudeAccount('c1', 'first@example.com'), claudeAccount('c2', 'second@example.com')],
    codex: [codexAccount('x1', 'codex@example.com')],
    activeClaudeId: 'c1',
    activeCodexId: 'x1',
    rateLimits: {
      claude: limits('claude', 26, 68),
      codex: limits('codex', 17, 20),
      inactiveClaudeAccounts: [
        { accountId: 'c2', rateLimits: limits('claude', 10, 37), updatedAt: 0, isFetching: false }
      ]
    }
  }),
  render: () => (
    <Frame>
      <UsageAccountStrip />
    </Frame>
  )
})

export const highUsage = defineFixture({
  width: 1280,
  store: storeFor({
    claude: [claudeAccount('c1', 'first@example.com'), claudeAccount('c2', 'second@example.com')],
    codex: [],
    activeClaudeId: 'c2',
    activeCodexId: null,
    rateLimits: {
      claude: limits('claude', 100, 92),
      codex: limits('codex', 55, 81),
      inactiveClaudeAccounts: [
        { accountId: 'c1', rateLimits: limits('claude', 74, 30), updatedAt: 0, isFetching: false }
      ]
    }
  }),
  render: () => (
    <Frame>
      <UsageAccountStrip />
    </Frame>
  )
})

export const narrowAndLongEmail = defineFixture({
  width: 760,
  store: storeFor({
    claude: [
      claudeAccount('c1', 'a-very-long-account-name.with.dots@subdomain.example-company.co.kr'),
      claudeAccount('c2', 'second@example.com')
    ],
    codex: [codexAccount('x1', 'codex@example.com')],
    activeClaudeId: 'c1',
    activeCodexId: 'x1',
    rateLimits: {
      claude: limits('claude', 26, 68),
      codex: limits('codex', 17, 20),
      inactiveClaudeAccounts: [
        { accountId: 'c2', rateLimits: limits('claude', 10, 37), updatedAt: 0, isFetching: false }
      ]
    }
  }),
  render: () => (
    <Frame>
      <UsageAccountStrip />
    </Frame>
  )
})

export const waitingForData = defineFixture({
  width: 1280,
  store: storeFor({
    claude: [claudeAccount('c1', 'first@example.com'), claudeAccount('c2', 'second@example.com')],
    codex: [codexAccount('x1', 'codex@example.com')],
    activeClaudeId: 'c1',
    activeCodexId: 'x1',
    rateLimits: {
      claude: limits('claude', 26, 68),
      codex: null,
      inactiveClaudeAccounts: [
        { accountId: 'c2', rateLimits: null, updatedAt: 0, isFetching: true }
      ]
    }
  }),
  render: () => (
    <Frame>
      <UsageAccountStrip />
    </Frame>
  )
})
