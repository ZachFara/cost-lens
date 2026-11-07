import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { parseSummary } from '../core/summary.ts'
import type { History } from '../../types'

const IDLE: History = { status: 'idle' }

// Change the tag when History's fields change: it declines what an earlier version stored.
const history = atom({ plugin: 'cost-lens', key: 'history' } as const, IDLE, {
  shape: 'history-1',
})

const ANALYZER_TIMEOUT_MS = 5 * 60 * 1000

function failure(message: string): History {
  return { status: 'error', message }
}

async function runAnalyzer($: EngineInterface): Promise<History> {
  try {
    const run = await $.process.run(['node', `${$.plugin.root}/src/analyzer/cli.ts`], {
      timeoutMs: ANALYZER_TIMEOUT_MS,
    })
    if (run.exitCode !== 0) {
      const reason = run.stderr.trim().split('\n')[0] ?? ''
      return failure(
        reason === '' ? `the analyzer exited with code ${String(run.exitCode)}` : reason,
      )
    }
    const summary = parseSummary(run.stdout)
    return summary
      ? { status: 'ready', summary }
      : failure('the analyzer printed something unexpected')
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

/**
 * The analyzer's last run. The engine lists the state a module reads by scanning each
 * file, so reads of this atom stay in the file that defines it.
 */
export function readHistory($: EngineInterface): Promise<History> {
  return read($, history)
}

/** Reads the logs when nothing is loaded or the last read failed; one read at a time. */
export async function loadHistory($: EngineInterface): Promise<void> {
  const current = await read($, history)
  if (current.status === 'loading' || current.status === 'ready') return
  await update($, history, () => ({ status: 'loading' }))
  const result = await runAnalyzer($)
  await update($, history, () => result)
}
