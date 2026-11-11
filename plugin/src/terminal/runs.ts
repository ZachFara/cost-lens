/**
 * The programs the terminal view runs: the plugin's own log reader (as the mod runs it,
 * at low CPU priority with today's prices), `git` to find the repository, and `gh`.
 * Their output is untrusted data.
 */
import { execFile } from 'node:child_process'
import { extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parsePullRequests } from '../core/pull-requests.ts'
import { parseSummary } from '../core/summary.ts'
import type { Summary } from '../core/summary.ts'

import type { PullRequests } from './views.ts'

// The analyzer beside this file: cli.ts in the plugin, cli.js in the npm package's build.
const ANALYZER = fileURLToPath(
  new URL(`../analyzer/cli${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
)
const ANALYZER_TIMEOUT_MS = 5 * 60 * 1000
const GH_TIMEOUT_MS = 30 * 1000
const GIT_TIMEOUT_MS = 10 * 1000

interface Run {
  /** The exit code; null when the program could not start or was stopped. */
  code: number | null
  stdout: string
  stderr: string
}

/** Runs a program to the end; never throws. `signal` stops it (the view quit). */
function run(
  file: string,
  args: readonly string[],
  options: { cwd?: string; timeout: number; signal?: AbortSignal },
): Promise<Run> {
  return new Promise((resolve) => {
    execFile(file, args, { ...options, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : null
      resolve({ code, stdout, stderr: stderr === '' && error !== null ? error.message : stderr })
    })
  })
}

function firstLine(text: string, fallback: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  return line === '' ? fallback : line
}

/** The root of the git repository that holds `folder`; undefined outside one. */
export async function repositoryOf(folder: string): Promise<string | undefined> {
  const done = await run('git', ['rev-parse', '--show-toplevel'], {
    cwd: folder,
    timeout: GIT_TIMEOUT_MS,
  })
  const root = done.stdout.trim()
  return done.code === 0 && root !== '' ? root : undefined
}

export type LogsRead = { summary: Summary } | { error: string }

/** Where the logs are read from and whose branches are counted. */
export interface Source {
  /** The repository (else the folder) the view was started in. */
  project: string
  /** The logs folder; Claude Code's own (~/.claude/projects) when undefined. */
  logs: string | undefined
}

/** Reads the session logs with the plugin's analyzer. */
export async function readLogs(source: Source, signal?: AbortSignal): Promise<LogsRead> {
  const args = ['-n', '10', process.execPath, ANALYZER, '--live-prices', '--project']
  args.push(source.project, ...(source.logs === undefined ? [] : [source.logs]))
  const done = await run('nice', args, {
    timeout: ANALYZER_TIMEOUT_MS,
    ...(signal === undefined ? {} : { signal }),
  })
  if (done.code !== 0) {
    return { error: firstLine(done.stderr, `the analyzer exited with code ${String(done.code)}`) }
  }
  const summary = parseSummary(done.stdout)
  return summary ? { summary } : { error: 'the analyzer printed something unexpected' }
}

/** The repository's pull requests from `gh`, or why there are none. */
export async function listPullRequests(
  repository: string | undefined,
  signal?: AbortSignal,
): Promise<PullRequests> {
  if (repository === undefined) {
    return { status: 'error', message: 'this folder is not in a git repository' }
  }
  const args = ['pr', 'list', '--state', 'all', '--limit', '100']
  args.push('--json', 'number,title,state,headRefName')
  const done = await run('gh', args, {
    cwd: repository,
    timeout: GH_TIMEOUT_MS,
    ...(signal === undefined ? {} : { signal }),
  })
  if (done.code === null) {
    return { status: 'error', message: 'the GitHub CLI (gh) could not run here' }
  }
  if (done.code !== 0) {
    return { status: 'error', message: firstLine(done.stderr, 'gh pr list failed') }
  }
  const prs = parsePullRequests(done.stdout)
  return prs
    ? { status: 'ready', prs }
    : { status: 'error', message: 'gh printed something unexpected' }
}
