import { ChevronDown, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useResetCountdownClock } from '@/hooks/useResetCountdownClock'
import { translate } from '@/i18n/i18n'
import type {
  InactiveAccountUsage,
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../shared/rate-limit-types'
import {
  getDisplayedUsagePercentage,
  normalizeUsagePercentageDisplay,
  type UsagePercentageDisplay
} from '../../../../shared/usage-percentage-display'
import { useAppStore } from '../../store'
import { USAGE_STRIP_HEIGHT } from '../sidebar/workspace-chrome-metrics'
import { ClaudeSwitcherMenu } from './ClaudeSwitcherMenu'
import { CodexSwitcherMenu } from './CodexSwitcherMenu'
import { barColor, clampUsedPercent, ProviderIcon } from './tooltip'
import { formatUsagePercentageLabel } from './usage-percentage-label'

// Just over the main process 60s fetch debounce so a tick is never swallowed.
const INACTIVE_USAGE_REFRESH_MS = 61_000
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

type CardProvider = 'claude' | 'codex'

export type UsageAccountCard = {
  key: string
  provider: CardProvider
  email: string | null
  active: boolean
  limits: ProviderRateLimits | null
  isFetching: boolean
}

export function buildProviderUsageCards(
  provider: CardProvider,
  accounts: readonly { id: string; email: string }[],
  activeId: string | null,
  activeLimits: ProviderRateLimits | null,
  inactive: readonly InactiveAccountUsage[]
): UsageAccountCard[] {
  const cards = accounts.map((account): UsageAccountCard => {
    const active = account.id === activeId
    const usage = active ? undefined : inactive.find((entry) => entry.accountId === account.id)
    return {
      key: `${provider}:${account.id}`,
      provider,
      email: account.email,
      active,
      limits: active ? activeLimits : (usage?.rateLimits ?? null),
      isFetching: usage?.isFetching ?? false
    }
  })
  // No managed account selected: the live usage belongs to the CLI's own login.
  if (activeId === null && activeLimits) {
    cards.unshift({
      key: `${provider}:system`,
      provider,
      email: null,
      active: true,
      limits: activeLimits,
      isFetching: false
    })
  }
  return cards
}

export function formatResetDuration(ms: number): string {
  const days = Math.floor(ms / DAY_MS)
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS)
  const minutes = Math.max(0, Math.floor((ms % HOUR_MS) / MINUTE_MS))
  const day = translate('auto.components.status.bar.UsageAccountStrip.unitDay', 'd')
  const hour = translate('auto.components.status.bar.UsageAccountStrip.unitHour', 'h')
  const minute = translate('auto.components.status.bar.UsageAccountStrip.unitMinute', 'm')
  if (days > 0) {
    return `${days}${day} ${hours}${hour}`
  }
  return hours > 0 ? `${hours}${hour} ${minutes}${minute}` : `${minutes}${minute}`
}

function providerName(provider: CardProvider): string {
  return provider === 'claude' ? 'Claude' : 'Codex'
}

function WindowRow({
  label,
  window: usageWindow,
  display,
  now
}: {
  label: string
  window: RateLimitWindow
  display: UsagePercentageDisplay
  now: number
}): React.JSX.Element {
  const used = clampUsedPercent(usageWindow.usedPercent)
  const remainingMs = usageWindow.resetsAt === null ? null : usageWindow.resetsAt - now
  return (
    <div className="flex items-center gap-2 text-[11px] leading-4">
      <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
      <span
        className="w-9 shrink-0 whitespace-nowrap text-right tabular-nums text-foreground"
        title={formatUsagePercentageLabel(used, display)}
      >
        {Math.round(getDisplayedUsagePercentage(used, display))}%
      </span>
      <div className="h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barColor(used)}`}
          style={{ width: `${getDisplayedUsagePercentage(used, display)}%` }}
        />
      </div>
      {remainingMs !== null ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {remainingMs <= 0
            ? translate('auto.components.status.bar.UsageAccountStrip.resetsNow', 'Resetting')
            : translate(
                'auto.components.status.bar.UsageAccountStrip.resetsIn',
                '{{duration}} left',
                {
                  duration: formatResetDuration(remainingMs)
                }
              )}
        </span>
      ) : null}
    </div>
  )
}

// Reuses the status bar's account switcher so cards keep one-click account changes.
function AccountSwitcher({
  provider,
  limits
}: {
  provider: CardProvider
  limits: ProviderRateLimits
}): React.JSX.Element {
  const chevron = <ChevronDown size={13} className="text-muted-foreground" />
  return provider === 'claude' ? (
    <ClaudeSwitcherMenu claude={limits} compact iconOnly={false} triggerContent={chevron} />
  ) : (
    <CodexSwitcherMenu codex={limits} compact iconOnly={false} triggerContent={chevron} />
  )
}

function UsageCard({
  card,
  display
}: {
  card: UsageAccountCard
  display: UsagePercentageDisplay
}): React.JSX.Element {
  const { limits } = card
  const now = useResetCountdownClock([limits?.session?.resetsAt, limits?.weekly?.resetsAt])
  const hasWindows = Boolean(limits?.session || limits?.weekly)
  return (
    <div
      data-usage-account-card={card.key}
      data-active={card.active}
      className="flex min-w-[300px] max-w-[380px] flex-1 flex-col justify-center gap-0.5 rounded-md border border-border/70 bg-card/60 px-2.5 py-1 data-[active=true]:border-border"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
        <ProviderIcon provider={card.provider} />
        <span className="shrink-0 font-medium text-foreground">{providerName(card.provider)}</span>
        {card.email ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{card.email}</span>
        ) : (
          <span className="flex-1" />
        )}
        {card.active ? (
          <span className="shrink-0 rounded bg-accent px-1.5 text-[10px] text-accent-foreground">
            {translate('auto.components.status.bar.UsageAccountStrip.inUse', 'In use')}
          </span>
        ) : null}
        {card.active && limits ? (
          <AccountSwitcher provider={card.provider} limits={limits} />
        ) : null}
      </div>
      {limits?.session ? (
        <WindowRow
          label={translate('auto.components.status.bar.UsageAccountStrip.session', '5h')}
          window={limits.session}
          display={display}
          now={now}
        />
      ) : null}
      {limits?.weekly ? (
        <WindowRow
          label={translate('auto.components.status.bar.UsageAccountStrip.weekly', 'Weekly')}
          window={limits.weekly}
          display={display}
          now={now}
        />
      ) : null}
      {!hasWindows ? (
        <span className="text-[11px] text-muted-foreground">
          {card.isFetching || !limits || limits.status === 'fetching'
            ? translate(
                'auto.components.status.bar.UsageRosterPanel.loadingUsage',
                'Loading usage…'
              )
            : translate('auto.components.status.bar.UsageRosterPanel.noUsageData', 'No usage data')}
        </span>
      ) : null}
    </div>
  )
}

/** One card per signed-in Claude/Codex account, fixed and centered at the bottom of the main column. */
export function UsageAccountStrip(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const claude = useAppStore((s) => s.rateLimits.claude)
  const codex = useAppStore((s) => s.rateLimits.codex)
  const inactiveClaude = useAppStore((s) => s.rateLimits.inactiveClaudeAccounts)
  const inactiveCodex = useAppStore((s) => s.rateLimits.inactiveCodexAccounts)
  const display = normalizeUsagePercentageDisplay(useAppStore((s) => s.usagePercentageDisplay))
  const refreshRateLimits = useAppStore((s) => s.refreshRateLimits)
  const fetchInactiveClaudeAccountUsage = useAppStore((s) => s.fetchInactiveClaudeAccountUsage)
  const fetchInactiveCodexAccountUsage = useAppStore((s) => s.fetchInactiveCodexAccountUsage)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const claudeAccounts = settings?.claudeManagedAccounts
  const codexAccounts = settings?.codexManagedAccounts
  const activeClaudeId =
    settings?.activeClaudeManagedAccountIdsByRuntime?.host ??
    settings?.activeClaudeManagedAccountId ??
    null
  const activeCodexId =
    settings?.activeCodexManagedAccountIdsByRuntime?.host ??
    settings?.activeCodexManagedAccountId ??
    null

  const cards = useMemo(
    () => [
      ...buildProviderUsageCards(
        'claude',
        claudeAccounts ?? [],
        activeClaudeId,
        claude,
        inactiveClaude
      ),
      ...buildProviderUsageCards('codex', codexAccounts ?? [], activeCodexId, codex, inactiveCodex)
    ],
    [
      claudeAccounts,
      codexAccounts,
      activeClaudeId,
      activeCodexId,
      claude,
      codex,
      inactiveClaude,
      inactiveCodex
    ]
  )
  const hasInactiveClaude = cards.some((card) => card.provider === 'claude' && !card.active)
  const hasInactiveCodex = cards.some((card) => card.provider === 'codex' && !card.active)

  const refreshInactive = useCallback((): void => {
    if (hasInactiveClaude) {
      void fetchInactiveClaudeAccountUsage()
    }
    if (hasInactiveCodex) {
      void fetchInactiveCodexAccountUsage()
    }
  }, [
    hasInactiveClaude,
    hasInactiveCodex,
    fetchInactiveClaudeAccountUsage,
    fetchInactiveCodexAccountUsage
  ])

  // Inactive accounts are fetched on demand elsewhere, so this strip owns their polling.
  useEffect(() => {
    if (!hasInactiveClaude && !hasInactiveCodex) {
      return
    }
    refreshInactive()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        refreshInactive()
      }
    }, INACTIVE_USAGE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [hasInactiveClaude, hasInactiveCodex, refreshInactive])

  const handleRefresh = async (): Promise<void> => {
    if (isRefreshing) {
      return
    }
    setIsRefreshing(true)
    try {
      refreshInactive()
      await refreshRateLimits()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div
      data-usage-strip
      className="flex shrink-0 overflow-x-auto overflow-y-hidden border-t border-border bg-[var(--bg-titlebar,var(--card))] px-3 pt-1.5 text-xs select-none scrollbar-none"
      style={{ height: USAGE_STRIP_HEIGHT }}
    >
      {/* mx-auto centers while it fits and falls back to left-aligned scrolling when it overflows. */}
      <div className="mx-auto flex shrink-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <span>{translate('auto.components.status.bar.UsageRosterPanel.title', 'Usage')}</span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            aria-label={translate(
              'auto.components.status.bar.StatusBar.3325d996cb',
              'Refresh rate limits'
            )}
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-stretch gap-2 py-1">
          {cards.map((card) => (
            <UsageCard key={card.key} card={card} display={display} />
          ))}
        </div>
      </div>
    </div>
  )
}
