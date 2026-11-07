import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { PullRequests, Tab } from '../../types'

import { historyView } from './history-view.tsx'
import { loadHistory, readHistory, refreshHistory, startBackgroundRefresh } from './history.ts'
import { periodView } from './period-view.tsx'
import { projectsView } from './projects-view.tsx'
import { branchesView } from './branches-view.tsx'
import { prsView } from './prs-view.tsx'
import { nowView } from './now-view.tsx'
import { tipsView } from './tips-view.tsx'
import { modelView } from './model-view.tsx'
import type { Settings } from './settings.ts'
import { startBandClock } from './cache-band.tsx'
import { loadPullRequests, readPullRequests } from './pull-requests.ts'
import type { Period } from '../core/summary.ts'
import type { Actions, Ready, Ui } from './ui.ts'

const PANE_ID = 'cost-lens'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'model', label: 'Model' },
  { id: 'today', label: 'Today' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'projects', label: 'Projects' },
  { id: 'branches', label: 'Branches' },
  { id: 'prs', label: 'PRs' },
  { id: 'tips', label: 'Tips' },
]

/** The tabs that show a period of the analyzer's summary. */
const PERIOD_OF: Partial<Record<Tab, Period>> = { today: 'today', last30: 'last30', all: 'allTime' }

/** The tabs that draw the analyzer's summary; opening one starts the first read. */
const DATA_TABS: ReadonlySet<Tab> = new Set([
  'today',
  'last30',
  'all',
  'projects',
  'branches',
  'prs',
  'tips',
])

/** How a data tab draws the analyzer's summary; undefined for the other tabs. */
/** What some tabs read from the engine beside the summary. */
interface Extras {
  prs: PullRequests
  /** Tokens the session's loaded MCP tool definitions add to every request. */
  mcpTokens: number | undefined
}

function readyViewFor(tab: Tab, ui: Ui, columns: number, extras: Extras) {
  const period = PERIOD_OF[tab]
  if (period !== undefined) return (ready: Ready) => periodView(ui, ready, period, columns)
  if (tab === 'projects') return (ready: Ready) => projectsView(ui, ready)
  if (tab === 'branches') return (ready: Ready) => branchesView(ui, ready)
  if (tab === 'prs') return (ready: Ready) => prsView(ui, ready, extras.prs)
  if (tab === 'tips') return (ready: Ready) => tipsView(ui, ready, extras.mcpTokens)
  return undefined
}

const selectedTab = atom({ plugin: 'cost-lens', key: 'tab' } as const, 'now')

function select($: EngineInterface, tab: Tab): void {
  void update($, selectedTab, () => tab)
  if (DATA_TABS.has(tab)) void loadHistory($)
  if (tab === 'prs') void loadPullRequests($)
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

async function loadedMcpTokens($: EngineInterface): Promise<number | undefined> {
  try {
    const { context } = await $.session.usage({ breakdown: 'summary' })
    const tools = context.breakdown?.mcpTools ?? []
    return tools.filter((tool) => tool.isLoaded).reduce((sum, tool) => sum + tool.tokens, 0)
  } catch {
    return undefined
  }
}

/** What drawing a tab needs beside `$` (which the engine never lets into an object). */
interface Drawing {
  ui: Ui
  columns: number
  settings: Settings
}

async function tabBody($: EngineInterface, { ui, columns, settings }: Drawing, tab: Tab) {
  const prs = tab === 'prs' ? await readPullRequests($) : ({ status: 'idle' } as const)
  if (tab === 'now') return nowView($, ui, columns)
  if (tab === 'model') return modelView($, ui, settings)
  const mcpTokens = tab === 'tips' ? await loadedMcpTokens($) : undefined
  const readyView = readyViewFor(tab, ui, columns, { prs, mcpTokens })
  if (readyView === undefined) {
    const label = TABS.find((one) => one.id === tab)?.label ?? tab
    return <ui.Text weight="semibold">{label}</ui.Text>
  }
  const actions: Actions = {
    load: () => {
      void loadHistory($)
    },
    refresh: () => {
      void refreshHistory($)
      if (tab === 'prs') void loadPullRequests($, true)
    },
  }
  return historyView(ui, await readHistory($), actions, readyView)
}

/** `/cost-lens` opens the pane; the pane draws its tab row and the selected tab. */
export function registerPane(on: On, settings: Settings): void {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cost-lens',
      description: 'Show where Claude Code tokens and dollars go',
      argumentHint: '[band]',
    })
    startBackgroundRefresh($)
    startBandClock($)
    return next(e)
  })

  on('command.run', { command: 'cost-lens' }, async ($, e, next) => {
    // `/cost-lens band` belongs to the cache line (cache-band.tsx).
    if (e.args.trim() === 'band') return next(e)
    // Transparent: the terminal's own theme shows through, as it does behind the chat.
    const opened = await $.ui.open({
      id: PANE_ID,
      title: 'cost-lens',
      backgroundColor: 'transparent',
    })
    if (!opened.isPlaced)
      return { text: `cost-lens pane is open but not shown yet: ${opened.reason}` }
    // Panes dock beside the chat only in the fullscreen layout; elsewhere they sit above the prompt.
    return {
      text: e.presentation.isFullscreen
        ? 'cost-lens pane opened.'
        : 'cost-lens pane opened above the prompt. Run /tui fullscreen to dock it beside the chat.',
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
        {await tabBody($, { ui, columns: e.props.bodyColumns, settings }, tab)}
      </ui.Box>
    )
  })
}
