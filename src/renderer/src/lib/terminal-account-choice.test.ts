import { describe, expect, it, vi } from 'vitest'
import { normalizeTerminalAccountPin } from '../../../shared/terminal-account-pin'
import type { GlobalSettings } from '../../../shared/global-settings-types'

vi.mock('../store', () => ({ useAppStore: { getState: () => ({}), setState: () => {} } }))

import { buildTerminalAccountChoiceProviders, pinFromChoices } from './terminal-account-choice'

function settings(overrides: Partial<GlobalSettings>): GlobalSettings {
  return {
    claudeManagedAccounts: [],
    activeClaudeManagedAccountId: null,
    codexManagedAccounts: [],
    activeCodexManagedAccountId: null,
    ...overrides
  } as GlobalSettings
}

const claude = (id: string, runtime?: 'host' | 'wsl') =>
  ({ id, email: `${id}@example.test`, managedAuthRuntime: runtime }) as never
const codex = (id: string, runtime?: 'host' | 'wsl') =>
  ({ id, email: `${id}@example.test`, managedHomeRuntime: runtime }) as never

describe('normalizeTerminalAccountPin', () => {
  it('keeps well-formed ids, including an explicit System default', () => {
    expect(normalizeTerminalAccountPin({ claudeAccountId: 'a', codexAccountId: null })).toEqual({
      claudeAccountId: 'a',
      codexAccountId: null
    })
  })

  it('drops anything malformed so a bad payload never picks an account', () => {
    expect(normalizeTerminalAccountPin(undefined)).toBeUndefined()
    expect(normalizeTerminalAccountPin({})).toBeUndefined()
    expect(normalizeTerminalAccountPin({ claudeAccountId: '' })).toBeUndefined()
    expect(normalizeTerminalAccountPin({ claudeAccountId: 42 })).toBeUndefined()
    expect(normalizeTerminalAccountPin({ claudeAccountId: 'x'.repeat(300) })).toBeUndefined()
  })
})

describe('buildTerminalAccountChoiceProviders', () => {
  it('asks about a provider only when it has a managed account to pick besides System default', () => {
    expect(buildTerminalAccountChoiceProviders(settings({}))).toEqual([])

    const mixed = settings({ claudeManagedAccounts: [claude('a')] })
    expect(buildTerminalAccountChoiceProviders(mixed).map((p) => p.provider)).toEqual(['claude'])
  })

  it('ignores WSL accounts because the pin applies to local terminals', () => {
    const wslOnly = settings({
      claudeManagedAccounts: [claude('b', 'wsl')]
    })
    expect(buildTerminalAccountChoiceProviders(wslOnly)).toEqual([])
  })

  it('prefers the remembered account, then the globally active one, then System default', () => {
    const base = settings({
      claudeManagedAccounts: [claude('a'), claude('b')],
      activeClaudeManagedAccountId: 'a'
    })
    expect(buildTerminalAccountChoiceProviders(base, { claudeAccountId: 'b' })[0].defaultId).toBe(
      'b'
    )
    expect(buildTerminalAccountChoiceProviders(base)[0].defaultId).toBe('a')
    expect(
      buildTerminalAccountChoiceProviders(base, { claudeAccountId: 'deleted' })[0].defaultId
    ).toBe('a')
    expect(
      buildTerminalAccountChoiceProviders({ ...base, activeClaudeManagedAccountId: 'deleted' })[0]
        .defaultId
    ).toBeNull()
  })

  it('always offers System default as the last option', () => {
    const options = buildTerminalAccountChoiceProviders(
      settings({ claudeManagedAccounts: [claude('a'), claude('b')] })
    )[0].options
    expect(options.at(-1)?.id).toBeNull()
  })
})

describe('pinFromChoices', () => {
  it('uses the picked account and falls back to the default for untouched providers', () => {
    const providers = buildTerminalAccountChoiceProviders(
      settings({
        claudeManagedAccounts: [claude('a'), claude('b')],
        activeClaudeManagedAccountId: 'a',
        codexManagedAccounts: [codex('x'), codex('y')],
        activeCodexManagedAccountId: 'x'
      })
    )
    expect(pinFromChoices(providers, { claude: 'b' })).toEqual({
      claudeAccountId: 'b',
      codexAccountId: 'x'
    })
    expect(pinFromChoices(providers, { codex: null })).toEqual({
      claudeAccountId: 'a',
      codexAccountId: null
    })
  })
})
