import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import type { ClaudeProfileSetupReport } from './claude-profile-setup'
import { claudeProfileMarkerPath, type ClaudeProfileDescriptor } from './claude-profile-paths'
import { ClaudeProfileRouter, type ClaudeProfileRouterSettings } from './claude-profile-router'

vi.mock('../macos-keychain/generic-password', () => ({
  execSecurityCommand: async () => {
    throw new Error('The specified item could not be found in the keychain.')
  }
}))

const roots: string[] = []
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function fixture(setupOutcome: ClaudeProfileSetupReport['outcome'] = 'prepared') {
  const root = mkdtempSync(join(tmpdir(), 'claude-pane-account-'))
  roots.push(root)
  const account = (id: string): ClaudeManagedAccount => ({
    id,
    email: `${id}@example.test`,
    authMethod: 'subscription-oauth',
    managedAuthPath: '/unused-legacy',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  })
  const settings: ClaudeProfileRouterSettings = {
    claudeManagedAccounts: [account('a'), account('b')],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: undefined,
    agentStatusHooksEnabled: false,
    disabledTuiAgents: []
  }
  const dataRoot = join(root, 'data')
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot,
    userHome: join(root, 'personal'),
    env: {},
    runSetup: async ({ profile }: { profile: ClaudeProfileDescriptor }) => {
      mkdirSync(profile.home, { recursive: true })
      if (setupOutcome === 'prepared') {
        writeFileSync(claudeProfileMarkerPath(profile), '{}')
      }
      return { outcome: setupOutcome, warnings: [], surfaces: {} }
    }
  })
  const home = (id: string) => join(dataRoot, 'claude-profiles', id, 'home')
  return { router, home }
}

describe('ClaudeProfileRouter.preparePaneAccount', () => {
  it('routes a pinned pane to its own account while another is globally active', async () => {
    const f = fixture()
    const prepared = await f.router.preparePaneAccount('b', 'tab-1:leaf-1')

    expect(prepared.envPatch.CLAUDE_CONFIG_DIR).toBe(f.home('b'))
    expect(prepared.envPatch.ORCA_CLAUDE_INJECTED_CONFIG_DIR).toBe(f.home('b'))
    expect(prepared.provenance).toBe('profile:b')
    const pointer = prepared.envPatch.ORCA_CLAUDE_PROFILE_POINTER
    expect(pointer).not.toBe(f.router.pointerPath)
    expect(readFileSync(pointer!, 'utf8')).toBe(f.home('b'))
  })

  it('gives each pane its own pointer so panes never share an account by accident', async () => {
    const f = fixture()
    const first = await f.router.preparePaneAccount('a', 'tab-1:leaf-1')
    const second = await f.router.preparePaneAccount('b', 'tab-2:leaf-1')

    expect(first.envPatch.ORCA_CLAUDE_PROFILE_POINTER).not.toBe(
      second.envPatch.ORCA_CLAUDE_PROFILE_POINTER
    )
    expect(readFileSync(first.envPatch.ORCA_CLAUDE_PROFILE_POINTER!, 'utf8')).toBe(f.home('a'))
    expect(readFileSync(second.envPatch.ORCA_CLAUDE_PROFILE_POINTER!, 'utf8')).toBe(f.home('b'))
  })

  it('pins System default with an empty pointer and no injected config dir', async () => {
    const f = fixture()
    const prepared = await f.router.preparePaneAccount(null, 'tab-1:leaf-1')

    expect(readFileSync(prepared.envPatch.ORCA_CLAUDE_PROFILE_POINTER!, 'utf8')).toBe('')
    expect(prepared.envPatch.CLAUDE_CONFIG_DIR).toBeUndefined()
    expect(prepared.provenance).toBe('system')
  })

  it('refuses a deleted account instead of running another identity', async () => {
    const f = fixture()
    await expect(f.router.preparePaneAccount('gone', 'tab-1:leaf-1')).rejects.toThrow(
      /no longer exists/
    )
  })

  it('refuses the launch when the first-time account setup fails', async () => {
    const f = fixture('refused')
    await expect(f.router.preparePaneAccount('b', 'tab-1:leaf-1')).rejects.toThrow()
  })
})
