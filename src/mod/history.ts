import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { parseSummary } from '../core/summary.ts'
import type { Summary } from '../core/summary.ts'
import type { History } from '../../types'

const IDLE: History = { status: 'idle' }

// Change the tag when History's fields change: it declines what an earlier version stored.
const history = atom({ plugin: 'cost-lens', key: 'history' } as const, IDLE, {
  shape: 'history-2',
})

const ANALYZER_TIMEOUT_MS = 5 * 60 * 1000
const REFRESH_EVERY_MS = 5 * 60 * 1000
const PANE_ID = 'cost-lens'

type Read = { summary: Summary } | { error: string }

function ready(summary: Summary): History {
  return { status: 'ready', summary, isRefreshing: false, refreshError: null }
}

function failed(message: string): History {
  return { status: 'error', message }
}

/** Runs the analyzer at low CPU priority (nice 10) so a read never competes with the session. */
async function runAnalyzer($: EngineInterface): Promise<Read> {
  try {
    const cli = `${$.plugin.root}/src/analyzer/cli.ts`
    const run = await $.process.run(['nice', '-n', '10', 'node', cli], {
      timeoutMs: ANALYZER_TIMEOUT_MS,
    })
    if (run.exitCode !== 0) {
      const reason = run.stderr.trim().split('\n')[0] ?? ''
      return {
        error: reason === '' ? `the analyzer exited with code ${String(run.exitCode)}` : reason,
      }
    }
    const summary = parseSummary(run.stdout)
    return summary ? { summary } : { error: 'the analyzer printed something unexpected' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The analyzer's last run. The engine lists the state a module reads by scanning each
 * file, so reads of this atom stay in the file that defines it.
 */
export function readHistory($: EngineInterface): Promise<History> {
  return read($, history)
}

/** First read, or a retry after a failed one: the tab shows a loading line meanwhile. */
export async function loadHistory($: EngineInterface): Promise<void> {
  const current = await read($, history)
  if (current.status === 'loading' || current.status === 'ready') return
  await update($, history, () => ({ status: 'loading' }))
  const result = await runAnalyzer($)
  await update($, history, () =>
    'summary' in result ? ready(result.summary) : failed(result.error),
  )
}

/** Re-reads the logs while the last summary stays on screen; one refresh at a time. */
export async function refreshHistory($: EngineInterface): Promise<void> {
  const current = await read($, history)
  if (current.status !== 'ready' || current.isRefreshing) return
  await update($, history, () => ({ ...current, isRefreshing: true }))
  const result = await runAnalyzer($)
  await update($, history, () =>
    'summary' in result
      ? ready(result.summary)
      : { ...current, isRefreshing: false, refreshError: result.error },
  )
}

async function refreshIfShown($: EngineInterface): Promise<void> {
  const panes = await $.ui.panes()
  const isShown = panes.some((pane) => pane.id === PANE_ID && pane.isShown && pane.isPlaced)
  if (isShown) await refreshHistory($)
}

/** Every five minutes, refreshes the numbers if the pane is on screen and already loaded. */
export function startBackgroundRefresh($: EngineInterface): void {
  $.clock.every(REFRESH_EVERY_MS, () => {
    void refreshIfShown($)
  })
}
