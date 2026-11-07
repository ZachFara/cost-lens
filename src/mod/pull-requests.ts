import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { parsePullRequests } from '../core/pull-requests.ts'
import type { PullRequests } from '../../types'

const IDLE: PullRequests = { status: 'idle' }

// Change the tag when PullRequests' fields change: it declines what an earlier version stored.
const pullRequests = atom({ plugin: 'cost-lens', key: 'pullRequests' } as const, IDLE, {
  shape: 'pull-requests-1',
})

const GH_TIMEOUT_MS = 30 * 1000
const LIMIT = '100'

async function listPullRequests($: EngineInterface): Promise<PullRequests> {
  try {
    const cwd = (await $.session.repo())?.root
    if (cwd === undefined)
      return { status: 'error', message: 'this session is not in a git repository' }
    const argv = ['gh', 'pr', 'list', '--state', 'all', '--limit', LIMIT]
    const fields = ['--json', 'number,title,state,headRefName']
    const run = await $.process.run([...argv, ...fields], { cwd, timeoutMs: GH_TIMEOUT_MS })
    if (run.exitCode !== 0) {
      const reason = run.stderr.trim().split('\n')[0] ?? ''
      return { status: 'error', message: reason === '' ? 'gh pr list failed' : reason }
    }
    const prs = parsePullRequests(run.stdout)
    return prs
      ? { status: 'ready', prs }
      : { status: 'error', message: 'gh printed something unexpected' }
  } catch {
    return { status: 'error', message: 'the GitHub CLI (gh) could not run here' }
  }
}

/** The last `gh pr list`; reads of the atom stay in this file (the engine scans per file). */
export function readPullRequests($: EngineInterface): Promise<PullRequests> {
  return read($, pullRequests)
}

/** Lists the repository's pull requests; `force` re-lists ones already loaded. */
export async function loadPullRequests($: EngineInterface, force = false): Promise<void> {
  const current = await read($, pullRequests)
  if (current.status === 'loading' || (current.status === 'ready' && !force)) return
  if (current.status !== 'ready') await update($, pullRequests, () => ({ status: 'loading' }))
  const result = await listPullRequests($)
  await update($, pullRequests, () => result)
}
