import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ClaudeContextUsage } from '../../../shared/claude-context-usage'

type Reading = { usedPercent: number; at: number }

const STALE_AFTER_MS = 60_000
const DROP_AFTER_MS = 60 * 60_000
const STALE_CHECK_MS = 15_000

let readings: ReadonlyMap<string, Reading> = new Map()
const listeners = new Set<() => void>()

export function recordClaudeContextUsage(usage: ClaudeContextUsage, now = Date.now()): void {
  const next = new Map(readings)
  // A closed pane never posts again, so old readings are dropped as new ones arrive.
  for (const [key, reading] of next) {
    if (now - reading.at > DROP_AFTER_MS) {
      next.delete(key)
    }
  }
  next.set(usage.paneKey, { usedPercent: usage.usedPercent, at: now })
  readings = next
  listeners.forEach((listener) => listener())
}

export function getClaudeContextReadings(): ReadonlyMap<string, Reading> {
  return readings
}

export function resetClaudeContextUsageForTests(): void {
  readings = new Map()
  listeners.forEach((listener) => listener())
}

export type TabContextReading = { usedPercent: number; stale: boolean }

/** The fullest recent reading among a tab's panes; panes are keyed `<tabId>:<leafId>`. */
export function selectTabContext(
  all: ReadonlyMap<string, Reading>,
  tabId: string,
  now: number
): TabContextReading | null {
  let best: Reading | null = null
  for (const [paneKey, reading] of all) {
    if (paneKey.startsWith(`${tabId}:`) && (!best || reading.usedPercent > best.usedPercent)) {
      best = reading
    }
  }
  return best ? { usedPercent: best.usedPercent, stale: now - best.at > STALE_AFTER_MS } : null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTabContextUsage(tabId: string): TabContextReading | null {
  const all = useSyncExternalStore(
    subscribe,
    () => readings,
    () => readings
  )
  // Re-evaluate staleness even when no new reading arrives.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), STALE_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return selectTabContext(all, tabId, Math.max(now, Date.now()))
}
