import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Tab } from '../../types'

import { allTimeView } from './all-time.tsx'
import { loadHistory, readHistory, refreshHistory, startBackgroundRefresh } from './history.ts'

const PANE_ID = 'cost-lens'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'today', label: 'Today' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'projects', label: 'Projects' },
  { id: 'tips', label: 'Tips' },
]

const selectedTab = atom({ plugin: 'cost-lens', key: 'tab' } as const, 'now')

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
    const { Box, Button, Text } = ui
    const tab = await read($, selectedTab)
    const current = TABS.find((one) => one.id === tab) ?? TABS[0]
    const body =
      tab === 'all' ? (
        allTimeView(ui, await readHistory($), e.props.bodyColumns, {
          load: () => {
            void loadHistory($)
          },
          refresh: () => {
            void refreshHistory($)
          },
        })
      ) : (
        <Text weight="semibold">{current?.label}</Text>
      )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {TABS.map((one) => (
            <Button
              key={one.id}
              label={one.label}
              variant={one.id === tab ? 'primary' : 'secondary'}
              onPress={() => {
                void update($, selectedTab, () => one.id)
                if (one.id === 'all') void loadHistory($)
              }}
            />
          ))}
        </Box>
        {body}
      </Box>
    )
  })
}
