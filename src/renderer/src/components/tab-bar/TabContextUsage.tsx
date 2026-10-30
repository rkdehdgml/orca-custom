import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useTabContextUsage } from '@/lib/claude-context-usage-store'
import { cn } from '@/lib/utils'
import { claudeContextSeverity } from '../../../../shared/claude-context-usage'

const BADGE_CLASSES = {
  normal: 'bg-emerald-500/15 text-emerald-500',
  warn: 'bg-amber-500/15 text-amber-500',
  critical: 'bg-red-500/15 text-red-500'
} as const

const BAR_CLASSES = {
  normal: 'bg-emerald-500',
  warn: 'bg-amber-500',
  critical: 'bg-red-500'
} as const

/** The Claude context-window share of a tab: a number beside the account chip and a bar along the tab's edge. */
export function TabContextUsage({ tabId }: { tabId: string }): React.JSX.Element | null {
  const context = useTabContextUsage(tabId)
  if (!context) {
    return null
  }
  const percent = Math.round(context.usedPercent)
  const severity = claudeContextSeverity(context.usedPercent)
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-tab-context-usage="true"
            className={cn(
              'mr-1 shrink-0 rounded px-1 py-0.5 text-[11px] font-semibold tabular-nums leading-none',
              BADGE_CLASSES[severity],
              context.stale && 'opacity-50'
            )}
          >
            {percent}%
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {translate(
            'auto.components.tab.bar.TabContextUsage.tooltip',
            'Context window {{value0}}% used',
            { value0: String(percent) }
          )}
          {context.stale ? (
            <div className="text-muted-foreground">
              {translate(
                'auto.components.tab.bar.TabContextUsage.stale',
                'Not updated for over a minute'
              )}
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 h-[3px]',
          BAR_CLASSES[severity],
          context.stale && 'opacity-40'
        )}
        style={{ width: `${Math.min(100, Math.max(0, context.usedPercent))}%` }}
      />
    </>
  )
}
