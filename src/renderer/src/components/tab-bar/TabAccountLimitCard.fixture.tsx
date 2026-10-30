import type {
  ClaudeManagedAccount,
  CodexManagedAccount
} from '../../../../shared/managed-account-types'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { getDefaultSettings } from '../../../../shared/constants'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { TooltipProvider } from '@/components/ui/tooltip'
import { recordClaudeContextUsage } from '@/lib/claude-context-usage-store'
import { TabAccountChipBody } from './TabAccountChip'
import { TabAccountLimitCardBody } from './TabAccountLimitCard'

function limits(sessionPercent: number, weeklyPercent: number): ProviderRateLimits {
  const now = Date.now()
  return {
    provider: 'claude',
    session: {
      usedPercent: sessionPercent,
      windowMinutes: 300,
      resetsAt: now + 3_600_000,
      resetDescription: null
    },
    weekly: {
      usedPercent: weeklyPercent,
      windowMinutes: 10080,
      resetsAt: now + 2 * 86_400_000,
      resetDescription: null
    },
    updatedAt: now,
    error: null,
    status: 'ok'
  }
}

function account(id: string, email: string): ClaudeManagedAccount {
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

const TAB = {
  id: 't1',
  ptyId: null,
  worktreeId: 'wt1',
  title: 'Claude Code',
  customTitle: null,
  color: null,
  sortOrder: 0,
  createdAt: 0
}

function storeFor(
  accounts: ClaudeManagedAccount[],
  active: ClaudeManagedAccount,
  activeLimits: ProviderRateLimits,
  inactive: Record<string, ProviderRateLimits>
): Record<string, unknown> {
  return {
    settings: {
      ...getDefaultSettings('C:\\Users\\fixture'),
      claudeManagedAccounts: accounts,
      activeClaudeManagedAccountId: active.id,
      codexManagedAccounts: [] as CodexManagedAccount[]
    },
    tabsByWorktree: { wt1: [TAB] },
    rateLimits: createEmptyRateLimitState({
      claude: activeLimits,
      inactiveClaudeAccounts: Object.entries(inactive).map(([accountId, rateLimits]) => ({
        accountId,
        rateLimits,
        updatedAt: 0,
        isFetching: false
      }))
    })
  }
}

const first = account('c1', 'first@example.com')
const second = account('c2', 'second@example.com')
const third = account('c3', 'third@example.com')

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="relative h-64 bg-background">{children}</div>
}

export const withFreeAccount = defineFixture({
  width: 520,
  store: storeFor([first, second, third], first, limits(96, 40), {
    c2: limits(10, 37),
    c3: limits(97, 98)
  }),
  render: () => (
    <Frame>
      <TabAccountLimitCardBody tabId="t1" provider="claude" />
    </Frame>
  )
})

export const noAccountToSwitchTo = defineFixture({
  width: 520,
  store: storeFor([first], first, limits(30, 96), {}),
  render: () => (
    <Frame>
      <TabAccountLimitCardBody tabId="t1" provider="claude" />
    </Frame>
  )
})

export const chipInTab = defineFixture({
  width: 360,
  store: storeFor([first, second], first, limits(59, 73), { c2: limits(0, 12) }),
  render: () => (
    <TooltipProvider>
      <div className="flex h-9 items-center gap-1 border-b border-border bg-card px-2 text-xs">
        <span className="min-w-0 flex-1 truncate">Orca 사용량 표시 및 계정 분리</span>
        <TabAccountChipBody tabId="t1" provider="claude" />
        <span className="text-muted-foreground">×</span>
      </div>
    </TooltipProvider>
  )
})

function ContextTab({ title }: { title: string }): React.JSX.Element {
  return (
    <TooltipProvider>
      <div className="relative flex h-9 w-[360px] items-center gap-1 border-b border-border bg-card px-2 text-xs">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <TabAccountChipBody tabId="t1" provider="claude" />
        <span className="text-muted-foreground">×</span>
      </div>
    </TooltipProvider>
  )
}

export const contextNormal = defineFixture({
  width: 360,
  store: storeFor([first, second], first, limits(59, 73), { c2: limits(0, 12) }),
  setup: () => recordClaudeContextUsage({ paneKey: 't1:leaf-1', usedPercent: 23 }),
  render: () => <ContextTab title="Orca 사용량 표시 및 계정 분리" />
})

export const contextCritical = defineFixture({
  width: 360,
  store: storeFor([first, second], first, limits(59, 73), { c2: limits(0, 12) }),
  setup: () => recordClaudeContextUsage({ paneKey: 't1:leaf-1', usedPercent: 93 }),
  render: () => <ContextTab title="Orca 사용량 표시 및 계정 분리" />
})
