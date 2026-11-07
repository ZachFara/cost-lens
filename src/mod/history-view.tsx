import type { RenderElement } from 'claude-code'

import { formatClock } from '../core/format.ts'
import type { History } from '../../types'

import type { Actions, Ready, Ui } from './ui.ts'

function freshnessView(ui: Ui, state: Ready, refresh: () => void) {
  const { Box, Button, Text } = ui
  const when = state.isRefreshing
    ? 'Refreshing…'
    : `Read at ${formatClock(state.summary.generatedAt)}`
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>{when}</Text>
        <Button key="refresh" label="Refresh" onPress={refresh} />
      </Box>
      {state.refreshError === null ? null : (
        <Text color="warning">{`Last refresh failed: ${state.refreshError}`}</Text>
      )}
    </Box>
  )
}

/**
 * Every data tab: where reading the logs stands, or the tab's own view of the
 * summary with when it was read, a Refresh button and the price source.
 */
export function historyView(
  ui: Ui,
  state: History,
  actions: Actions,
  readyView: (ready: Ready) => RenderElement,
) {
  const { Box, Button, Text } = ui
  switch (state.status) {
    case 'idle':
      return <Button key="load" label="Read my logs" onPress={actions.load} />
    case 'loading':
      return <Text dimColor>Reading your Claude Code logs…</Text>
    case 'error':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="error">{`Could not read the logs: ${state.message}`}</Text>
          <Button key="load" label="Try again" onPress={actions.load} />
        </Box>
      )
    case 'ready':
      return (
        <Box flexDirection="column" gap={1}>
          {readyView(state)}
          <Text dimColor>
            {`Estimated from this machine's logs at Anthropic's published prices (${state.summary.pricesFetched}).`}
          </Text>
          {freshnessView(ui, state, actions.refresh)}
        </Box>
      )
  }
}
