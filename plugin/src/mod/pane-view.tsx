import type { History, PullRequests, Recommendation, Tab } from '../../types'

import { branchesView } from './branches-view.tsx'
import { historyView } from './history-view.tsx'
import { modelView } from './model-view.tsx'
import { nowView } from './now-view.tsx'
import type { NowFacts } from './now-view.tsx'
import { periodView } from './period-view.tsx'
import { projectsView } from './projects-view.tsx'
import { prsView } from './prs-view.tsx'
import type { Settings } from './settings.ts'
import { PERIOD_OF, TABS } from './tabs.ts'
import { tipsView } from './tips-view.tsx'
import type { Actions, Ready, Ui } from './ui.ts'

/** Everything the pane draws, read by the hooks module for the selected tab. */
export interface PaneData {
  tab: Tab
  columns: number
  settings: Settings
  history: History
  prs: PullRequests
  recommendations: readonly Recommendation[]
  /** The session's model, read for the Model tab only. */
  currentModel: string
  /** Read for the Now tab only; undefined when the engine cannot report the session. */
  facts: NowFacts | undefined
  /** Tokens the session's loaded MCP tool definitions add to every request (Tips only). */
  mcpTokens: number | undefined
}

/** What the pane's buttons do. */
export interface PaneHandlers extends Actions {
  select: (tab: Tab) => void
}

function tabRow(ui: Ui, selected: Tab, onSelect: (tab: Tab) => void) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      {TABS.map((one, index) => (
        <Button
          key={one.id}
          label={one.label}
          // 1 to 9 select a tab while the pane holds the keyboard (ctrl+x tab).
          hotkey={String(index + 1)}
          variant={one.id === selected ? 'primary' : 'secondary'}
          onPress={() => {
            onSelect(one.id)
          }}
        />
      ))}
    </Box>
  )
}

/** How a data tab draws the analyzer's summary; undefined for the other tabs. */
function readyViewFor(ui: Ui, data: PaneData) {
  const period = PERIOD_OF[data.tab]
  if (period !== undefined) return (ready: Ready) => periodView(ui, ready, period, data.columns)
  if (data.tab === 'projects') return (ready: Ready) => projectsView(ui, ready)
  if (data.tab === 'branches') return (ready: Ready) => branchesView(ui, ready)
  if (data.tab === 'prs') return (ready: Ready) => prsView(ui, ready, data.prs)
  if (data.tab === 'tips') return (ready: Ready) => tipsView(ui, ready, data.mcpTokens)
  return undefined
}

function tabBody(ui: Ui, data: PaneData, handlers: PaneHandlers) {
  if (data.tab === 'now') return nowView(ui, data.facts, data.columns)
  if (data.tab === 'model') {
    return modelView(ui, data.settings, data.recommendations, data.currentModel)
  }
  const readyView = readyViewFor(ui, data)
  if (readyView === undefined) {
    const label = TABS.find((one) => one.id === data.tab)?.label ?? data.tab
    return <ui.Text weight="semibold">{label}</ui.Text>
  }
  return historyView(ui, data.history, handlers, readyView)
}

/** The pane: its tab row, then the selected tab. */
export function paneView(ui: Ui, data: PaneData, handlers: PaneHandlers) {
  return (
    <ui.Box flexDirection="column" gap={1}>
      {tabRow(ui, data.tab, handlers.select)}
      {tabBody(ui, data, handlers)}
    </ui.Box>
  )
}
