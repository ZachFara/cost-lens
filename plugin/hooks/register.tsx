/**
 * The hooks module: every hook, the state they share and every call on `$`. Anthropic's
 * plugin directory reads a mod's calls from source, and only in this shape: `$` is called
 * as `$.noun.method(...)` or passed whole to a function of this file, and `on` likewise.
 * Everything else (views, parsing, wording) is a pure function under src/mod.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, Register } from 'claude-code'

import type { History, LastRequest, PullRequests, Recommendation, Tab } from '../types'
import {
  KEPT,
  MIN_PROMPT_CHARS,
  TIER_LABELS,
  adviceText,
  shouldSuggest,
  tierOf,
} from '../src/mod/advice.ts'
import { bandView } from '../src/mod/band-view.tsx'
import { coldCacheWarning } from '../src/mod/cold-warning.ts'
import { NO_REQUESTS, addStep, stepPromptTokens } from '../src/mod/live-record.ts'
import { gridColumns } from '../src/mod/now-view.tsx'
import type { NowFacts } from '../src/mod/now-view.tsx'
import { paneView } from '../src/mod/pane-view.tsx'
import type { PaneData, PaneHandlers } from '../src/mod/pane-view.tsx'
import {
  ANALYZER_TIMEOUT_MS,
  GH_TIMEOUT_MS,
  cacheLifetime,
  errorText,
  loaded,
  projectArgs,
  readAnalyzerRun,
  readGhRun,
  refreshed,
} from '../src/mod/runs.ts'
import type { AnalyzerRead } from '../src/mod/runs.ts'
import { readSettings } from '../src/mod/settings.ts'
import type { Settings } from '../src/mod/settings.ts'
import { DATA_TABS } from '../src/mod/tabs.ts'

const PANE_ID = 'cost-lens'
const REFRESH_EVERY_MS = 5 * 60 * 1000
const MINUTE_MS = 60 * 1000
const TOAST_MS = 10_000

const IDLE_HISTORY: History = { status: 'idle' }
const IDLE_PRS: PullRequests = { status: 'idle' }
const NO_RECOMMENDATIONS: Recommendation[] = []
const NO_REQUEST: LastRequest | null = null

// Change a tag when its value's fields change: it declines what an earlier version stored.
const selectedTab = atom({ plugin: 'cost-lens', key: 'tab' } as const, 'now')
const historyState = atom({ plugin: 'cost-lens', key: 'history' } as const, IDLE_HISTORY, {
  shape: 'history-9',
})
const prsState = atom({ plugin: 'cost-lens', key: 'pullRequests' } as const, IDLE_PRS, {
  shape: 'pull-requests-1',
})
const liveState = atom({ plugin: 'cost-lens', key: 'live' } as const, NO_REQUESTS, {
  shape: 'live-1',
})
const lastRequest = atom({ plugin: 'cost-lens', key: 'lastRequest' } as const, NO_REQUEST, {
  shape: 'last-request-1',
})
const isBandHidden = atom({ plugin: 'cost-lens', key: 'isBandHidden' } as const, false)
/** Bumped every minute so the band's countdown redraws. */
const minute = atom({ plugin: 'cost-lens', key: 'minute' } as const, 0)
// Newest first; only the tier, models and time are kept, never the prompt's text.
const recommendations = atom(
  { plugin: 'cost-lens', key: 'recommendations' } as const,
  NO_RECOMMENDATIONS,
  { shape: 'recommendations-1' },
)
const lastAdviceAt = atom({ plugin: 'cost-lens', key: 'lastAdviceAt' } as const, 0)

/** The repository the session runs in, else its folder; undefined if the engine cannot say. */
async function sessionFolder($: EngineInterface): Promise<string | undefined> {
  try {
    const repo = await $.session.repo()
    return repo === null ? await $.session.cwd() : repo.root
  } catch {
    return undefined
  }
}

async function runAnalyzer($: EngineInterface): Promise<AnalyzerRead> {
  try {
    const project = projectArgs(await sessionFolder($))
    const cli = `${$.plugin.root}/src/analyzer/cli.ts`
    // The plugin's own log reader, at low CPU priority, with today's prices.
    const run = await $.process.run(
      ['nice', '-n', '10', 'node', cli, '--live-prices', ...project],
      {
        timeoutMs: ANALYZER_TIMEOUT_MS,
      },
    )
    return readAnalyzerRun(run)
  } catch (error) {
    return { error: errorText(error) }
  }
}

/** First read, or a retry after a failed one: the tab shows a loading line meanwhile. */
async function loadHistory($: EngineInterface): Promise<void> {
  const current = await read($, historyState)
  if (current.status === 'loading' || current.status === 'ready') return
  await update($, historyState, () => ({ status: 'loading' }))
  const result = await runAnalyzer($)
  await update($, historyState, () => loaded(result))
}

/** Re-reads the logs while the last summary stays on screen; one refresh at a time. */
async function refreshHistory($: EngineInterface): Promise<void> {
  const current = await read($, historyState)
  if (current.status !== 'ready' || current.isRefreshing) return
  await update($, historyState, () => ({ ...current, isRefreshing: true }))
  const result = await runAnalyzer($)
  await update($, historyState, () => refreshed(current, result))
}

async function refreshIfShown($: EngineInterface): Promise<void> {
  const panes = await $.ui.panes()
  const isShown = panes.some((pane) => pane.id === PANE_ID && pane.isShown && pane.isPlaced)
  if (isShown) await refreshHistory($)
}

async function listPullRequests($: EngineInterface): Promise<PullRequests> {
  try {
    const repo = await $.session.repo()
    if (repo === null)
      return { status: 'error', message: 'this session is not in a git repository' }
    const run = await $.process.run(
      [
        'gh',
        'pr',
        'list',
        '--state',
        'all',
        '--limit',
        '100',
        '--json',
        'number,title,state,headRefName',
      ],
      { cwd: repo.root, timeoutMs: GH_TIMEOUT_MS },
    )
    return readGhRun(run)
  } catch {
    return { status: 'error', message: 'the GitHub CLI (gh) could not run here' }
  }
}

/** Lists the repository's pull requests; `force` re-lists ones already loaded. */
async function loadPullRequests($: EngineInterface, force: boolean): Promise<void> {
  const current = await read($, prsState)
  if (current.status === 'loading' || (current.status === 'ready' && !force)) return
  if (current.status !== 'ready') await update($, prsState, () => ({ status: 'loading' }))
  const result = await listPullRequests($)
  await update($, prsState, () => result)
}

function selectTab($: EngineInterface, tab: Tab): void {
  void update($, selectedTab, () => tab)
  if (DATA_TABS.has(tab)) void loadHistory($)
  if (tab === 'prs') void loadPullRequests($, false)
}

function paneHandlers($: EngineInterface, tab: Tab): PaneHandlers {
  return {
    select: (next) => {
      selectTab($, next)
    },
    load: () => {
      void loadHistory($)
    },
    refresh: () => {
      void refreshHistory($)
      if (tab === 'prs') void loadPullRequests($, true)
    },
  }
}

async function nowFacts($: EngineInterface, columns: number): Promise<NowFacts | undefined> {
  try {
    // Reading the minute redraws the tab each minute, so a window empties once it resets.
    const [usage, model, live, now] = await Promise.all([
      $.session.usage({ breakdown: 'summary', columns: gridColumns(columns) }),
      $.session.model(),
      read($, liveState),
      $.clock.now(),
      read($, minute),
    ])
    return { usage, model, live, now }
  } catch {
    return undefined
  }
}

async function loadedMcpTokens($: EngineInterface): Promise<number | undefined> {
  try {
    const usage = await $.session.usage({ breakdown: 'summary' })
    const tools = usage.context.breakdown?.mcpTools ?? []
    return tools.filter((tool) => tool.isLoaded).reduce((sum, tool) => sum + tool.tokens, 0)
  } catch {
    return undefined
  }
}

async function paneData($: EngineInterface, tab: Tab, columns: number, settings: Settings) {
  const [history, prs, recent] = await Promise.all([
    read($, historyState),
    read($, prsState),
    read($, recommendations),
  ])
  const data: PaneData = {
    tab,
    columns,
    settings,
    history,
    prs,
    recommendations: recent,
    currentModel: tab === 'model' && settings.llmFeatures ? await $.session.model() : '',
    facts: tab === 'now' ? await nowFacts($, columns) : undefined,
    mcpTokens: tab === 'tips' ? await loadedMcpTokens($) : undefined,
  }
  return data
}

async function cacheState($: EngineInterface) {
  const [request, history] = await Promise.all([read($, lastRequest), read($, historyState)])
  return { request, lifetimeMs: cacheLifetime(history) }
}

/**
 * With LLM features on, the small fast model judges the prompt's tier; the Model tab
 * shows the fitting model and, with notifications on, a toast suggests it when it is not
 * the current model's family, at most every ten minutes. Never throws.
 */
async function adviseModel($: EngineInterface, text: string, settings: Settings) {
  if (!settings.llmFeatures || text.trim().length < MIN_PROMPT_CHARS) return
  try {
    const answer = await $.model.classify(text, TIER_LABELS, { model: 'haiku' })
    const fit = tierOf(answer, await read($, historyState))
    if (fit === undefined) return
    const [current, now] = await Promise.all([$.session.model(), $.clock.now()])
    const entry: Recommendation = { tier: fit.tier, model: fit.model, current, at: now }
    await update($, recommendations, (list) => [entry, ...list].slice(0, KEPT))
    if (!settings.recommendationAlerts) return
    if (!shouldSuggest(fit, current, now, await read($, lastAdviceAt))) return
    await update($, lastAdviceAt, () => now)
    $.ui.toast(adviceText(fit, current), { timeoutMs: TOAST_MS })
  } catch {
    // Advice is optional: a failed classification changes nothing.
  }
}

function registerSession(on: On): void {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cost-lens',
      description: 'Show where Claude Code tokens and dollars go',
      argumentHint: '[band]',
    })
    // The numbers refresh every five minutes while the pane is shown and loaded.
    $.clock.every(REFRESH_EVERY_MS, () => {
      void refreshIfShown($)
    })
    $.clock.every(MINUTE_MS, () => {
      void update($, minute, (count) => count + 1)
    })
    return next(e)
  })
}

function registerCommands(on: On): void {
  on('command.run', { command: 'cost-lens' }, async ($, e, next) => {
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

  on('command.run', { command: 'cost-lens', args: 'band' }, async ($) => {
    await update($, isBandHidden, () => false)
    return { text: 'cost-lens cache line shown.' }
  })
}

function registerViews(on: On, settings: Settings): void {
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const tab = await read($, selectedTab)
    const data = await paneData($, tab, e.props.bodyColumns, settings)
    return paneView(ui, data, paneHandlers($, tab))
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, minute)
    const { request, lifetimeMs } = await cacheState($)
    if (e.props.hasSurvey || request === null || (await read($, isBandHidden))) return next(e)
    const now = await $.clock.now()
    return bandView($.ui.resolve(e), { request, lifetimeMs, now }, () => {
      void update($, isBandHidden, () => true)
    })
  })
}

function registerActivity(on: On, settings: Settings): void {
  // Counts every model request of the session as its response completes.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    if (usage === null) return result
    await update($, liveState, (totals) => addStep(totals, usage))
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      const promptTokens = stepPromptTokens(usage)
      await update($, lastRequest, () => ({ at, model: usage.model, promptTokens }))
    }
    return result
  })

  // A typed prompt: the cold-cache warning, then the model recommendation. Neither holds,
  // delays or changes the prompt; a failure lets it through.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.origin.kind !== 'composer') return next(e)
    const { request, lifetimeMs } = await cacheState($)
    const warning = coldCacheWarning(request, lifetimeMs, await $.clock.now())
    const result = await next(e)
    if (warning !== undefined) $.ui.toast(warning, { timeoutMs: TOAST_MS })
    await adviseModel($, e.text, settings)
    return result
  }).catch((_, e, next) => next(e))
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  registerSession(on)
  registerCommands(on)
  registerViews(on, settings)
  registerActivity(on, settings)
}
