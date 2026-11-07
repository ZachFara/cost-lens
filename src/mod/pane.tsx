import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { Tab } from '../../types'

import { historyView } from './history-view.tsx'
import { loadHistory, readHistory, refreshHistory, startBackgroundRefresh } from './history.ts'
import { periodView } from './period-view.tsx'
import type { Period } from '../core/summary.ts'
import type { Actions, Ui } from './ui.ts'

const PANE_ID = 'cost-lens'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'today', label: 'Today' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'projects', label: 'Projects' },
  { id: 'tips', label: 'Tips' },
]

/** The tabs that show a period of the analyzer's summary. */
const PERIOD_OF: Partial<Record<Tab, Period>> = { today: 'today', last30: 'last30', all: 'allTime' }

const selectedTab = atom({ plugin: 'cost-lens', key: 'tab' } as const, 'now')

function select($: EngineInterface, tab: Tab): void {
  void update($, selectedTab, () => tab)
  if (PERIOD_OF[tab] !== undefined) void loadHistory($)
}

function tabRow(ui: Ui, selected: Tab, onSelect: (tab: Tab) => void) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      {TABS.map((one) => (
        <Button
          key={one.id}
          label={one.label}
          variant={one.id === selected ? 'primary' : 'secondary'}
          onPress={() => {
            onSelect(one.id)
          }}
        />
      ))}
    </Box>
  )
}

async function tabBody($: EngineInterface, ui: Ui, tab: Tab, columns: number) {
  const period = PERIOD_OF[tab]
  if (period === undefined) {
    const label = TABS.find((one) => one.id === tab)?.label ?? tab
    return <ui.Text weight="semibold">{label}</ui.Text>
  }
  const actions: Actions = {
    load: () => {
      void loadHistory($)
    },
    refresh: () => {
      void refreshHistory($)
    },
  }
  return historyView(ui, await readHistory($), actions, (ready) =>
    periodView(ui, ready, period, columns),
  )
}

/** `/cost-lens` opens the pane; the pane draws its tab row and the selected tab. */
export function registerPane(on: On): void {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cost-lens',
      description: 'Show where Claude Code tokens and dollars go',
    })
    startBackgroundRefresh($)
    return next(e)
  })

  on('command.run', { command: 'cost-lens' }, async ($) => {
    // Transparent: the terminal's own theme shows through, as it does behind the chat.
    const opened = await $.ui.open({
      id: PANE_ID,
      title: 'cost-lens',
      backgroundColor: 'transparent',
    })
    return {
      text: opened.isPlaced
        ? 'cost-lens pane opened.'
        : `cost-lens pane is open but not shown yet: ${opened.reason}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const tab = await read($, selectedTab)
    return (
      <ui.Box flexDirection="column" gap={1}>
        {tabRow(ui, tab, (next) => {
          select($, next)
        })}
        {await tabBody($, ui, tab, e.props.bodyColumns)}
      </ui.Box>
    )
  })
}
