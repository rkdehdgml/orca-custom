import { Check, ChevronDown } from 'lucide-react'
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  accountDotClass,
  isHostLocalTab,
  switchTabAccount,
  tabAccountProvider,
  type TabAccountProvider
} from '@/lib/terminal-tab-account'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { TabContextUsage } from './TabContextUsage'
import { formatTabAccountUsage, useTabAccountOptions } from './use-tab-account-options'

export function openAccountSettings(provider: TabAccountProvider): void {
  const { openSettingsTarget, openSettingsPage } = useAppStore.getState()
  openSettingsTarget({
    pane: 'accounts',
    repoId: null,
    sectionId: provider === 'claude' ? 'accounts-claude' : 'accounts-codex'
  })
  openSettingsPage()
}

function stopTabGestures(event: React.SyntheticEvent): void {
  // The tab underneath activates and starts drags on pointer-down; the chip only opens its menu.
  event.stopPropagation()
}

/** Which Claude/Codex account this tab runs, with a menu to move just this tab to another one. */
export function TabAccountChip({
  tabId,
  agent
}: {
  tabId: string
  agent: string | null
}): React.JSX.Element | null {
  const provider = tabAccountProvider(agent)
  return provider ? <HostTabChip tabId={tabId} provider={provider} /> : null
}

function HostTabChip({
  tabId,
  provider
}: {
  tabId: string
  provider: TabAccountProvider
}): React.JSX.Element | null {
  const hostLocal = useAppStore((s) => isHostLocalTab(s, tabId))
  return hostLocal ? <TabAccountChipBody tabId={tabId} provider={provider} /> : null
}

export function TabAccountChipBody({
  tabId,
  provider
}: {
  tabId: string
  provider: TabAccountProvider
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const { accounts, currentId, current, limitsFor } = useTabAccountOptions(tabId, provider)
  const others = accounts.filter((account) => account.id !== currentId)
  const systemDefault = translate(
    'auto.components.tab.bar.TabAccountChip.systemDefault',
    'System default'
  )
  const currentLabel = current?.email ?? systemDefault
  const usage = formatTabAccountUsage(limitsFor(currentId))
  const providerLabel =
    provider === 'claude'
      ? translate('auto.components.tab.bar.TabAccountChip.claudeAccount', 'Claude account')
      : translate('auto.components.tab.bar.TabAccountChip.codexAccount', 'Codex account')

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-tab-account-chip="true"
                className="relative z-10 mr-1 flex h-4 shrink-0 items-center gap-0.5 rounded-sm px-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                aria-label={translate(
                  'auto.components.tab.bar.TabAccountChip.aria',
                  'Account for this tab: {{value0}}',
                  { value0: currentLabel }
                )}
                onPointerDown={stopTabGestures}
                onMouseDown={stopTabGestures}
                onClick={stopTabGestures}
                onDoubleClick={stopTabGestures}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    accountDotClass(settings, provider, currentId)
                  )}
                />
                <ChevronDown className="size-3" aria-hidden />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="font-medium">{currentLabel}</div>
            {usage ? <div className="text-muted-foreground">{usage}</div> : null}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="min-w-56"
          onClick={stopTabGestures}
          onPointerDown={stopTabGestures}
        >
          <DropdownMenuLabel>{providerLabel}</DropdownMenuLabel>
          <DropdownMenuItem disabled className="gap-2 opacity-100">
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                accountDotClass(settings, provider, currentId)
              )}
            />
            <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
            <Check className="size-3.5 shrink-0" aria-hidden />
          </DropdownMenuItem>
          {others.length > 0 || currentId !== null ? (
            <>
              {others.map((account) => {
                const accountUsage = formatTabAccountUsage(limitsFor(account.id))
                return (
                  <DropdownMenuItem
                    key={account.id}
                    className="gap-2"
                    onSelect={() =>
                      switchTabAccount({
                        tabId,
                        provider,
                        accountId: account.id,
                        label: account.email
                      })
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        accountDotClass(settings, provider, account.id)
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{account.email}</span>
                    {accountUsage ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{accountUsage}</span>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
              {currentId !== null ? (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    switchTabAccount({ tabId, provider, accountId: null, label: systemDefault })
                  }
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      accountDotClass(settings, provider, null)
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{systemDefault}</span>
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {translate(
                'auto.components.tab.bar.TabAccountChip.noOtherAccount',
                'No other account to switch to.'
              )}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openAccountSettings(provider)}>
            {others.length > 0
              ? translate(
                  'auto.components.tab.bar.TabAccountChip.manageAccounts',
                  'Manage accounts…'
                )
              : translate('auto.components.tab.bar.TabAccountChip.addAccount', 'Add account…')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {provider === 'claude' ? <TabContextUsage tabId={tabId} /> : null}
    </>
  )
}
