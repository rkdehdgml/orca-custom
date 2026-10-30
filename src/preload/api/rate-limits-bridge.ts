import { ipcRenderer } from 'electron'
import type {
  CodexRateLimitResetResult,
  RateLimitRuntimeTarget,
  RateLimitState
} from '../../shared/rate-limit-types'
import {
  CLAUDE_CONTEXT_USAGE_CHANNEL,
  type ClaudeContextUsage
} from '../../shared/claude-context-usage'
import type { PreloadApi } from '../api-types'

export const rateLimitsApi = {
  get: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:get'),
  refresh: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:refresh'),
  refreshCodexForTarget: (target: RateLimitRuntimeTarget): Promise<RateLimitState> =>
    ipcRenderer.invoke('rateLimits:refreshCodexForTarget', target),
  consumeCodexResetCredit: (): Promise<CodexRateLimitResetResult> =>
    ipcRenderer.invoke('rateLimits:consumeCodexResetCredit'),
  refreshClaudeForTarget: (target: RateLimitRuntimeTarget): Promise<RateLimitState> =>
    ipcRenderer.invoke('rateLimits:refreshClaudeForTarget', target),
  fetchInactiveClaudeAccounts: (): Promise<void> =>
    ipcRenderer.invoke('rateLimits:fetchInactiveClaudeAccounts'),
  fetchInactiveCodexAccounts: (): Promise<void> =>
    ipcRenderer.invoke('rateLimits:fetchInactiveCodexAccounts'),
  refreshGrok: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:refreshGrok'),
  onUpdate: (callback: (state: RateLimitState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: RateLimitState) => callback(state)
    ipcRenderer.on('rateLimits:update', listener)
    return () => ipcRenderer.removeListener('rateLimits:update', listener)
  },
  onClaudeContext: (callback: (usage: ClaudeContextUsage) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, usage: ClaudeContextUsage) =>
      callback(usage)
    ipcRenderer.on(CLAUDE_CONTEXT_USAGE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(CLAUDE_CONTEXT_USAGE_CHANNEL, listener)
  }
} satisfies PreloadApi['rateLimits']
