import type { GlobalSettings } from '../../../shared/global-settings-types'
import {
  normalizeTerminalAccountPin,
  type TerminalAccountPin
} from '../../../shared/terminal-account-pin'
import { useAppStore } from '../store'
import { locateTerminalTab } from '../store/terminals/terminal-tab-location'

export type TerminalAccountChoiceOption = { id: string | null; label: string }

export type TerminalAccountChoiceProvider = {
  provider: 'claude' | 'codex'
  options: TerminalAccountChoiceOption[]
  defaultId: string | null
}

export type TerminalAccountChoicePrompt = {
  id: number
  providers: TerminalAccountChoiceProvider[]
}

const LAST_CHOICE_KEY = 'orca.terminalAccountChoice.v1'

function readLastChoice(): TerminalAccountPin {
  try {
    return (
      normalizeTerminalAccountPin(JSON.parse(localStorage.getItem(LAST_CHOICE_KEY) ?? 'null')) ?? {}
    )
  } catch {
    return {}
  }
}

function writeLastChoice(pin: TerminalAccountPin): void {
  try {
    localStorage.setItem(LAST_CHOICE_KEY, JSON.stringify({ ...readLastChoice(), ...pin }))
  } catch {
    // The remembered default is a convenience; a blocked store only loses it.
  }
}

function pickDefault(
  options: readonly TerminalAccountChoiceOption[],
  remembered: string | null | undefined,
  globalId: string | null
): string | null {
  const has = (id: string | null | undefined): id is string | null =>
    id !== undefined && options.some((option) => option.id === id)
  if (has(remembered)) {
    return remembered
  }
  return has(globalId) ? globalId : null
}

/** A provider is asked about when it has a local managed account, since System default is always the other choice. */
export function buildTerminalAccountChoiceProviders(
  settings: GlobalSettings,
  last: TerminalAccountPin = {}
): TerminalAccountChoiceProvider[] {
  const providers: TerminalAccountChoiceProvider[] = []
  const claude = settings.claudeManagedAccounts.filter(
    (account) => account.managedAuthRuntime !== 'wsl'
  )
  if (claude.length >= 1) {
    const options = [
      ...claude.map((account) => ({ id: account.id, label: account.email })),
      { id: null, label: '' }
    ]
    providers.push({
      provider: 'claude',
      options,
      defaultId: pickDefault(
        options,
        last.claudeAccountId,
        settings.activeClaudeManagedAccountIdsByRuntime?.host ??
          settings.activeClaudeManagedAccountId ??
          null
      )
    })
  }
  const codex = settings.codexManagedAccounts.filter(
    (account) => account.managedHomeRuntime !== 'wsl'
  )
  if (codex.length >= 1) {
    const options = [
      ...codex.map((account) => ({ id: account.id, label: account.email })),
      { id: null, label: '' }
    ]
    providers.push({
      provider: 'codex',
      options,
      defaultId: pickDefault(
        options,
        last.codexAccountId,
        settings.activeCodexManagedAccountIdsByRuntime?.host ??
          settings.activeCodexManagedAccountId ??
          null
      )
    })
  }
  return providers
}

export function pinFromChoices(
  providers: readonly TerminalAccountChoiceProvider[],
  chosen: Readonly<Partial<Record<'claude' | 'codex', string | null>>>
): TerminalAccountPin {
  const pin: TerminalAccountPin = {}
  for (const provider of providers) {
    const id = provider.provider in chosen ? chosen[provider.provider] : provider.defaultId
    if (provider.provider === 'claude') {
      pin.claudeAccountId = id ?? null
    } else {
      pin.codexAccountId = id ?? null
    }
  }
  return pin
}

let currentPrompt: TerminalAccountChoicePrompt | null = null
let resolveCurrent: ((pin: TerminalAccountPin) => void) | null = null
let nextPromptId = 1
let promptChain: Promise<unknown> = Promise.resolve()
const listeners = new Set<() => void>()

export function subscribeTerminalAccountChoice(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTerminalAccountChoicePrompt(): TerminalAccountChoicePrompt | null {
  return currentPrompt
}

export function answerTerminalAccountChoice(pin: TerminalAccountPin): void {
  const resolve = resolveCurrent
  currentPrompt = null
  resolveCurrent = null
  listeners.forEach((listener) => listener())
  resolve?.(pin)
}

// Several tabs can open at once (a new workspace); ask one at a time so answers never cross tabs.
export function requestTerminalAccountChoice(
  providers: TerminalAccountChoiceProvider[]
): Promise<TerminalAccountPin> {
  const run = promptChain.then(
    () =>
      new Promise<TerminalAccountPin>((resolve) => {
        currentPrompt = { id: nextPromptId++, providers }
        resolveCurrent = resolve
        listeners.forEach((listener) => listener())
      })
  )
  promptChain = run.catch(() => undefined)
  return run
}

function storeTabAccountPin(tabId: string, pin: TerminalAccountPin): void {
  useAppStore.setState((state) => {
    const location = locateTerminalTab(state.tabsByWorktree, tabId)
    if (!location) {
      return {}
    }
    const tabs = state.tabsByWorktree[location.worktreeId].slice()
    tabs[location.index] = { ...location.tab, accountPin: pin }
    return { tabsByWorktree: { ...state.tabsByWorktree, [location.worktreeId]: tabs } }
  })
}

const pendingByTab = new Map<string, Promise<TerminalAccountPin | undefined>>()

/**
 * The account pin a spawn must carry. A fresh local terminal with a choice to make waits here for
 * the user's answer; restores, reattaches and remote terminals never ask.
 */
export function resolveTerminalAccountPinForSpawn(args: {
  tabId: string | undefined
  connectionId: string | null | undefined
  admittedSessionId: string | undefined
}): Promise<TerminalAccountPin | undefined> {
  const { tabId } = args
  if (!tabId) {
    return Promise.resolve(undefined)
  }
  const state = useAppStore.getState()
  const location = locateTerminalTab(state.tabsByWorktree, tabId)
  if (!location) {
    return Promise.resolve(undefined)
  }
  if (location.tab.accountPin) {
    return Promise.resolve(location.tab.accountPin)
  }
  if (args.admittedSessionId || args.connectionId || !state.settings) {
    return Promise.resolve(undefined)
  }
  const pending = pendingByTab.get(tabId)
  if (pending) {
    return pending
  }
  const providers = buildTerminalAccountChoiceProviders(state.settings, readLastChoice())
  if (providers.length === 0) {
    return Promise.resolve(undefined)
  }
  const asked = requestTerminalAccountChoice(providers)
    .then((pin) => {
      storeTabAccountPin(tabId, pin)
      writeLastChoice(pin)
      return pin
    })
    .finally(() => pendingByTab.delete(tabId))
  pendingByTab.set(tabId, asked)
  return asked
}
