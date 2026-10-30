import { X } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  accountDotClass,
  findLimitReached,
  isHostLocalTab,
  peakUsedPercent,
  switchTabAccount,
  tabRunningProvider,
  TAB_ACCOUNT_LIMIT_PERCENT,
  type TabAccountProvider
} from '@/lib/terminal-tab-account'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { openAccountSettings } from './TabAccountChip'
import { formatTabAccountUsage, useTabAccountOptions } from './use-tab-account-options'

// "Keep" holds until the window resets, which changes `resetsAt` and so the key.
const dismissedPrompts = new Set<string>()

/** Offers the active tab's agent another account once its 5h or weekly usage reaches the threshold. */
export function TabAccountLimitCard(): React.JSX.Element | null {
  const tabId = useAppStore((s) => s.activeTabId)
  const provider = useAppStore((s) => (s.activeTabId ? tabRunningProvider(s, s.activeTabId) : null))
  const hostLocal = useAppStore((s) => (s.activeTabId ? isHostLocalTab(s, s.activeTabId) : false))
  return tabId && provider && hostLocal ? (
    <TabAccountLimitCardBody key={`${tabId}:${provider}`} tabId={tabId} provider={provider} />
  ) : null
}

export function TabAccountLimitCardBody({
  tabId,
  provider
}: {
  tabId: string
  provider: TabAccountProvider
}): React.JSX.Element | null {
  const settings = useAppStore((s) => s.settings)
  const { accounts, currentId, current, limitsFor } = useTabAccountOptions(tabId, provider)
  const [, rerender] = useState(0)
  const reached = findLimitReached(limitsFor(currentId))
  const promptKey = reached
    ? `${tabId}:${provider}:${currentId}:${reached.window}:${reached.resetsAt ?? ''}`
    : null
  if (!reached || !promptKey || dismissedPrompts.has(promptKey)) {
    return null
  }

  const systemDefaultLabel = translate(
    'auto.components.tab.bar.TabAccountChip.systemDefault',
    'System default'
  )
  // System default has no readable usage, so it is offered last and never counts as full.
  const candidates = [
    ...accounts
      .filter((account) => account.id !== currentId)
      .map((account) => ({ id: account.id as string | null, label: account.email }))
      .map((entry) => ({ ...entry, limits: limitsFor(entry.id) }))
      .sort((a, b) => peakUsedPercent(a.limits) - peakUsedPercent(b.limits)),
    ...(currentId !== null ? [{ id: null, label: systemDefaultLabel, limits: null }] : [])
  ]
  const isBlocked = (limits: ReturnType<typeof limitsFor>): boolean =>
    limits !== null && peakUsedPercent(limits) >= TAB_ACCOUNT_LIMIT_PERCENT
  const keep = (): void => {
    dismissedPrompts.add(promptKey)
    rerender((count) => count + 1)
  }
  const windowLabel =
    reached.window === 'session'
      ? translate('auto.components.status.bar.UsageAccountStrip.session', '5h')
      : translate('auto.components.status.bar.UsageAccountStrip.weekly', 'Weekly')
  const currentLabel = current?.email ?? systemDefaultLabel
  const anyAvailable = candidates.some(({ limits }) => !isBlocked(limits))

  return (
    <div
      role="alertdialog"
      aria-label={translate(
        'auto.components.tab.bar.TabAccountLimitCard.title',
        'Continue with another account'
      )}
      className="absolute right-3 top-2 z-30 w-80 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {translate(
              'auto.components.tab.bar.TabAccountLimitCard.title',
              'Continue with another account'
            )}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {translate(
              'auto.components.tab.bar.TabAccountLimitCard.reached',
              '{{value0}} is at {{value1}} {{value2}}%.',
              {
                value0: currentLabel,
                value1: windowLabel,
                value2: String(Math.round(reached.usedPercent))
              }
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={keep}
          aria-label={translate('auto.components.tab.bar.TabAccountLimitCard.keep', 'Keep')}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {anyAvailable ? (
        <div className="mt-2 space-y-1">
          {candidates.map(({ id, label, limits }) => {
            const blocked = isBlocked(limits)
            const usage = formatTabAccountUsage(limits)
            return (
              <button
                key={id ?? 'system-default'}
                type="button"
                disabled={blocked}
                onClick={() => switchTabAccount({ tabId, provider, accountId: id, label })}
                className="flex w-full min-w-0 items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-left hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    accountDotClass(settings, provider, id)
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {usage ? <span className="shrink-0 text-muted-foreground">{usage}</span> : null}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-2 text-muted-foreground">
          {translate(
            'auto.components.tab.bar.TabAccountLimitCard.noAccount',
            'There is no account to switch to.'
          )}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {anyAvailable && candidates.some(({ id }) => id !== null) ? null : (
          <Button type="button" size="sm" onClick={() => openAccountSettings(provider)}>
            {translate('auto.components.tab.bar.TabAccountChip.addAccount', 'Add account…')}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={keep}>
          {translate('auto.components.tab.bar.TabAccountLimitCard.keep', 'Keep')}
        </Button>
      </div>
    </div>
  )
}
