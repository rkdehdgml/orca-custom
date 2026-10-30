import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore, type AppState } from '@/store'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { InactiveAccountUsage, ProviderRateLimits } from '../../../shared/rate-limit-types'
import { makePaneKey } from '../../../shared/stable-pane-id'
import type { TerminalAccountPin } from '../../../shared/terminal-account-pin'
import { getCodexSelectionLaneKey } from '../../../shared/codex-selection-lane'
import { locateTerminalTab } from '../store/terminals/terminal-tab-location'
import {
  isForeignMachineCodexPtyId,
  resolveCodexPaneSelectionLane
} from './codex-pane-selection-lane'
import { patchTabAccountPin } from './terminal-account-choice'

export type TabAccountProvider = 'claude' | 'codex'
export type TabAccountOption = { id: string; email: string }
export type TabLimitReached = {
  window: 'session' | 'weekly'
  usedPercent: number
  resetsAt: number | null
}

export const TAB_ACCOUNT_LIMIT_PERCENT = 95

const ACCOUNT_DOT_CLASSES = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-teal-500'
] as const

/** One color per account by its place in the account list, so tab chips and usage cards agree. */
export function accountDotClass(
  settings: GlobalSettings | null | undefined,
  provider: TabAccountProvider,
  accountId: string | null
): string {
  const index = managedAccountsFor(settings, provider).findIndex((a) => a.id === accountId)
  return index < 0 ? 'bg-muted-foreground' : ACCOUNT_DOT_CLASSES[index % ACCOUNT_DOT_CLASSES.length]
}

/** Account pins only reach local host terminals; WSL and remote tabs keep their own logins. */
export function isHostLocalTab(state: AppState, tabId: string): boolean {
  const location = locateTerminalTab(state.tabsByWorktree, tabId)
  const ptyId = state.ptyIdsByTabId[tabId]?.[0]
  if (!location || !ptyId || isForeignMachineCodexPtyId(ptyId)) {
    return false
  }
  return (
    resolveCodexPaneSelectionLane({ state, tab: location.tab, ptyId }).laneKey ===
    getCodexSelectionLaneKey(null)
  )
}

export function tabAccountProvider(agent: string | null | undefined): TabAccountProvider | null {
  return agent === 'claude' || agent === 'codex' ? agent : null
}

/** Local accounts only: a pin never reaches WSL terminals. */
export function managedAccountsFor(
  settings: GlobalSettings | null | undefined,
  provider: TabAccountProvider
): TabAccountOption[] {
  if (!settings) {
    return []
  }
  return provider === 'claude'
    ? settings.claudeManagedAccounts
        .filter((account) => account.managedAuthRuntime !== 'wsl')
        .map(({ id, email }) => ({ id, email }))
    : settings.codexManagedAccounts
        .filter((account) => account.managedHomeRuntime !== 'wsl')
        .map(({ id, email }) => ({ id, email }))
}

export function globalActiveAccountId(
  settings: GlobalSettings | null | undefined,
  provider: TabAccountProvider
): string | null {
  if (!settings) {
    return null
  }
  return provider === 'claude'
    ? (settings.activeClaudeManagedAccountIdsByRuntime?.host ??
        settings.activeClaudeManagedAccountId ??
        null)
    : (settings.activeCodexManagedAccountIdsByRuntime?.host ??
        settings.activeCodexManagedAccountId ??
        null)
}

/** The account a tab runs: its own pin, else whatever is selected globally. Null is System default. */
export function effectiveTabAccountId(
  settings: GlobalSettings | null | undefined,
  pin: TerminalAccountPin | undefined,
  provider: TabAccountProvider
): string | null {
  const pinned = provider === 'claude' ? pin?.claudeAccountId : pin?.codexAccountId
  return pinned !== undefined ? pinned : globalActiveAccountId(settings, provider)
}

/** Usage for one account: the live snapshot when it is the global one, else the polled inactive copy. */
export function tabAccountLimits(args: {
  settings: GlobalSettings | null | undefined
  provider: TabAccountProvider
  accountId: string | null
  activeLimits: ProviderRateLimits | null
  inactive: readonly InactiveAccountUsage[]
}): ProviderRateLimits | null {
  if (args.accountId === globalActiveAccountId(args.settings, args.provider)) {
    return args.activeLimits
  }
  if (args.accountId === null) {
    return null
  }
  return args.inactive.find((entry) => entry.accountId === args.accountId)?.rateLimits ?? null
}

/** The fuller window that crossed the prompt threshold; null below it. */
export function findLimitReached(limits: ProviderRateLimits | null): TabLimitReached | null {
  const hits: TabLimitReached[] = []
  for (const window of ['session', 'weekly'] as const) {
    const entry = limits?.[window]
    if (entry && entry.usedPercent >= TAB_ACCOUNT_LIMIT_PERCENT) {
      hits.push({ window, usedPercent: entry.usedPercent, resetsAt: entry.resetsAt })
    }
  }
  return hits.sort((a, b) => b.usedPercent - a.usedPercent)[0] ?? null
}

/** The fuller window's percent; unknown usage sorts last so a known account is offered first. */
export function peakUsedPercent(limits: ProviderRateLimits | null): number {
  if (!limits) {
    return Number.POSITIVE_INFINITY
  }
  return Math.max(limits.session?.usedPercent ?? 0, limits.weekly?.usedPercent ?? 0)
}

/** The Claude/Codex agent running in a tab's panes, if any; Claude wins when both run. */
export function tabRunningProvider(state: AppState, tabId: string): TabAccountProvider | null {
  const found = new Set<TabAccountProvider>()
  for (const leafId of Object.keys(state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId ?? {})) {
    const provider = tabAccountProvider(
      state.agentStatusByPaneKey[makePaneKey(tabId, leafId)]?.agentType
    )
    if (provider) {
      found.add(provider)
    }
  }
  return found.has('claude') ? 'claude' : found.has('codex') ? 'codex' : null
}

function providerPtyIds(state: AppState, tabId: string, provider: TabAccountProvider): string[] {
  const ptyIdsByLeafId = state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId ?? {}
  const bound = state.ptyIdsByTabId[tabId] ?? []
  return Object.entries(ptyIdsByLeafId).flatMap(([leafId, ptyId]) =>
    ptyId &&
    bound.includes(ptyId) &&
    state.agentStatusByPaneKey[makePaneKey(tabId, leafId)]?.agentType === provider
      ? [ptyId]
      : []
  )
}

function isProviderMidTurn(state: AppState, tabId: string, provider: TabAccountProvider): boolean {
  const ptyIdsByLeafId = state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId ?? {}
  return Object.keys(ptyIdsByLeafId).some((leafId) => {
    const entry = state.agentStatusByPaneKey[makePaneKey(tabId, leafId)]
    return entry?.agentType === provider && entry.state !== 'done'
  })
}

// Claude's queued restart already waits for the turn to end; Codex's would cut it off, so wait here.
function queueRestartWhenIdle(tabId: string, provider: TabAccountProvider): void {
  const queue = (): void => {
    const state = useAppStore.getState()
    state.queuePaneAccountRestarts(providerPtyIds(state, tabId, provider), provider)
  }
  if (provider === 'claude' || !isProviderMidTurn(useAppStore.getState(), tabId, provider)) {
    queue()
    return
  }
  const unsubscribe = useAppStore.subscribe((state) => {
    const tabGone = !(tabId in state.terminalLayoutsByTabId)
    if (tabGone || !isProviderMidTurn(state, tabId, provider)) {
      unsubscribe()
      if (!tabGone) {
        queue()
      }
    }
  })
}

/** Pins the tab to another account and restarts only its own agent, resuming the same session. */
export function switchTabAccount(args: {
  tabId: string
  provider: TabAccountProvider
  accountId: string | null
  label: string
}): void {
  const { tabId, provider, accountId, label } = args
  patchTabAccountPin(
    tabId,
    provider === 'claude' ? { claudeAccountId: accountId } : { codexAccountId: accountId }
  )
  const state = useAppStore.getState()
  if (providerPtyIds(state, tabId, provider).length === 0) {
    return
  }
  const midTurn = isProviderMidTurn(state, tabId, provider)
  queueRestartWhenIdle(tabId, provider)
  toast.success(
    midTurn
      ? translate(
          'auto.components.tab.bar.TabAccountChip.switchWaiting',
          'Switching this tab to {{value0}} once the current reply finishes.',
          { value0: label }
        )
      : translate(
          'auto.components.tab.bar.TabAccountChip.switching',
          'Switching this tab to {{value0}}.',
          { value0: label }
        )
  )
}
