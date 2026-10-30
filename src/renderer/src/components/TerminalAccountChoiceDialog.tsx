import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { translate } from '@/i18n/i18n'
import {
  answerTerminalAccountChoice,
  getTerminalAccountChoicePrompt,
  pinFromChoices,
  subscribeTerminalAccountChoice,
  type TerminalAccountChoicePrompt
} from '@/lib/terminal-account-choice'

const SYSTEM_DEFAULT_VALUE = '__system-default__'

export default function TerminalAccountChoiceDialog(): React.JSX.Element | null {
  const prompt = useSyncExternalStore(
    subscribeTerminalAccountChoice,
    getTerminalAccountChoicePrompt,
    getTerminalAccountChoicePrompt
  )
  // Remount per prompt so each terminal starts from its own remembered defaults.
  return prompt ? <ChoiceDialog key={prompt.id} prompt={prompt} /> : null
}

function toValue(id: string | null): string {
  return id ?? SYSTEM_DEFAULT_VALUE
}

function fromValue(value: string): string | null {
  return value === SYSTEM_DEFAULT_VALUE ? null : value
}

function ChoiceDialog({ prompt }: { prompt: TerminalAccountChoicePrompt }): React.JSX.Element {
  const [chosen, setChosen] = useState<Partial<Record<'claude' | 'codex', string | null>>>(() =>
    Object.fromEntries(prompt.providers.map((p) => [p.provider, p.defaultId]))
  )
  const confirm = (): void => answerTerminalAccountChoice(pinFromChoices(prompt.providers, chosen))
  return (
    <Dialog
      open
      // Closing starts the terminal with the highlighted accounts rather than leaving it blank.
      onOpenChange={(open) => {
        if (!open) {
          confirm()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault()
            confirm()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.status.bar.TerminalAccountChoice.title',
              'Choose accounts for this terminal'
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.status.bar.TerminalAccountChoice.description',
              'This terminal keeps these accounts until it is closed, even if you switch accounts elsewhere.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {prompt.providers.map((provider) => (
            <fieldset key={provider.provider} className="space-y-2">
              <legend className="text-sm font-medium">
                {provider.provider === 'claude'
                  ? translate(
                      'auto.components.status.bar.TerminalAccountChoice.claude',
                      'Claude account'
                    )
                  : translate(
                      'auto.components.status.bar.TerminalAccountChoice.codex',
                      'Codex account'
                    )}
              </legend>
              <RadioGroup
                value={toValue(chosen[provider.provider] ?? null)}
                onValueChange={(value) =>
                  setChosen((current) => ({ ...current, [provider.provider]: fromValue(value) }))
                }
              >
                {provider.options.map((option) => {
                  const inputId = `terminal-account-${provider.provider}-${toValue(option.id)}`
                  return (
                    <label
                      key={inputId}
                      htmlFor={inputId}
                      className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-accent/50"
                    >
                      <RadioGroupItem id={inputId} value={toValue(option.id)} />
                      <span className="min-w-0 flex-1 truncate">
                        {option.id === null
                          ? translate(
                              'auto.components.status.bar.TerminalAccountChoice.systemDefault',
                              'System default'
                            )
                          : option.label}
                      </span>
                    </label>
                  )
                })}
              </RadioGroup>
            </fieldset>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" size="sm" autoFocus onClick={confirm}>
            {translate('auto.components.status.bar.TerminalAccountChoice.start', 'Start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
