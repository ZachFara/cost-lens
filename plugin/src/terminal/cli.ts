#!/usr/bin/env node
/**
 * cost-lens in a plain terminal, outside Claude Code:
 *   cost-lens [logs folder]                     (the npm package)
 *   node <plugin>/src/terminal/cli.ts [logs folder]   (the plugin, or a working copy)
 *
 * In a terminal it runs full screen, like top, until q. With its output piped or
 * redirected (`... | less`), it prints every tab once as plain text and exits.
 * Branches and PRs are those of the repository it is started in.
 */
import { runApp } from './app.ts'
import { listPullRequests, readLogs, repositoryOf } from './runs.ts'
import type { Source } from './runs.ts'
import { afterRead, TABS, tabLines } from './screen.ts'
import { paint, span } from './text.ts'

const USAGE = `Usage: cost-lens [logs folder]

Shows where your Claude Code tokens and dollars go, from the session logs on this
machine (~/.claude/projects unless a folder is given).

Keys: 1-8 or ←/→ switch tabs, ↑/↓ and space scroll, r refreshes, q quits.
Piped or redirected, it prints every tab once and exits.
`

const WIDTH = 80

/** Every tab once, one after another, for a pipe or a file. */
async function printAll(source: Source, repository: string | undefined): Promise<void> {
  const [read, prs] = await Promise.all([readLogs(source), listPullRequests(repository)])
  const history = afterRead({ status: 'loading' }, read)
  const width = Math.min(process.stdout.columns || WIDTH, WIDTH)
  const color = process.stdout.isTTY && process.env.NO_COLOR === undefined
  const lines = TABS.flatMap((one) => [
    [span(one.label, 'bold')],
    [span('─'.repeat(width), 'dim')],
    ...tabLines({ tab: one.id, scroll: 0, history, prs, now: Date.now() }, width),
    [],
  ])
  process.stdout.write(`${lines.map((line) => paint(line, width, color)).join('\n')}\n`)
  if (history.status === 'error') process.exitCode = 1
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(USAGE)
} else {
  const folder = process.cwd()
  const repository = await repositoryOf(folder)
  const source: Source = { project: repository ?? folder, logs: args[0] }
  if (process.stdin.isTTY && process.stdout.isTTY) runApp(source, repository)
  else await printAll(source, repository)
}
