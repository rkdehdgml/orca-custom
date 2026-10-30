import { useMemo } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { locateTerminalTab } from '@/store/terminals/terminal-tab-location'
import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import {
  effectiveTabAccountId,
  managedAccountsFor,
  tabAccountLimits,
  type TabAccountOption,
  type TabAccountProvider
} from '@/lib/terminal-tab-account'

export type TabAccountOptions = {
  accounts: TabAccountOption[]
  currentId: string | null
  current: TabAccountOption | null
  limitsFor: (accountId: string | null) => ProviderRateLimits | null
}

/** Accounts a tab can switch among, the one it runs now, and usage for each. */
export function useTabAccountOptions(
  tabId: string,
  provider: TabAccountProvider
): TabAccountOptions {
  const settings = useAppStore((s) => s.settings)
  const pin = useAppStore((s) => locateTerminalTab(s.tabsByWorktree, tabId)?.tab.accountPin)
  const activeLimits = useAppStore((s) => s.rateLimits[provider])
  const inactive = useAppStore((s) =>
    provider === 'claude' ? s.rateLimits.inactiveClaudeAccounts : s.rateLimits.inactiveCodexAccounts
  )
  return useMemo(() => {
    const accounts = managedAccountsFor(settings, provider)
    const currentId = effectiveTabAccountId(settings, pin, provider)
    return {
      accounts,
      currentId,
      current: accounts.find((account) => account.id === currentId) ?? null,
      limitsFor: (accountId) =>
        tabAccountLimits({ settings, provider, accountId, activeLimits, inactive })
    }
  }, [settings, pin, provider, activeLimits, inactive])
}

/** "5h 59% · Weekly 73%", or empty while no usage is known. */
export function formatTabAccountUsage(limits: ProviderRateLimits | null): string {
  const parts: string[] = []
  if (limits?.session) {
    parts.push(
      `${translate('auto.components.status.bar.UsageAccountStrip.session', '5h')} ${Math.round(limits.session.usedPercent)}%`
    )
  }
  if (limits?.weekly) {
    parts.push(
      `${translate('auto.components.status.bar.UsageAccountStrip.weekly', 'Weekly')} ${Math.round(limits.weekly.usedPercent)}%`
    )
  }
  return parts.join(' · ')
}
