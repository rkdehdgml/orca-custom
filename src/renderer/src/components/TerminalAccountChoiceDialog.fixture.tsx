import { defineFixture } from '../component-fixtures/component-fixture'
import { requestTerminalAccountChoice } from '@/lib/terminal-account-choice'
import TerminalAccountChoiceDialog from './TerminalAccountChoiceDialog'

const accounts = (provider: 'claude' | 'codex') => [
  { id: `${provider}-1`, label: `first-${provider}@example.com` },
  { id: `${provider}-2`, label: `second-${provider}@example.com` },
  { id: null, label: '' }
]

export const claudeAndCodex = defineFixture({
  width: 640,
  setup: () => {
    void requestTerminalAccountChoice([
      { provider: 'claude', options: accounts('claude'), defaultId: 'claude-2' },
      { provider: 'codex', options: accounts('codex'), defaultId: 'codex-1' }
    ])
  },
  render: () => <TerminalAccountChoiceDialog />
})

export const claudeOnlyLongEmail = defineFixture({
  width: 640,
  setup: () => {
    void requestTerminalAccountChoice([
      {
        provider: 'claude',
        options: [
          {
            id: 'claude-1',
            label: 'a-very-long-account-name.with.dots@subdomain.example-company.co.kr'
          },
          { id: 'claude-2', label: 'second@example.com' },
          { id: null, label: '' }
        ],
        defaultId: 'claude-1'
      }
    ])
  },
  render: () => <TerminalAccountChoiceDialog />
})
