/**
 * The terminal view as a full-screen program, like top: it takes over the terminal (the
 * alternate screen), redraws on every key and resize, re-reads the logs every five
 * minutes, and gives the terminal back as it was when it quits.
 */
import { listPullRequests, readLogs } from './runs.ts'
import type { Source } from './runs.ts'
import { afterRead, frame, keysIn, pressKey } from './screen.ts'
import type { Command, Size, View } from './screen.ts'
import { paint } from './text.ts'

/** As the pane: the numbers refresh on their own every five minutes while shown. */
const REFRESH_MS = 5 * 60 * 1000

// The alternate screen, the cursor hidden and line wrap off (a line too long is cut at
// the edge), and back.
const ENTER = '\u001b[?1049h\u001b[?25l\u001b[?7l'
const LEAVE = '\u001b[?7h\u001b[?25h\u001b[?1049l'

interface App {
  view: View
  source: Source
  repository: string | undefined
  isReading: boolean
  hasListed: boolean
  /** Stops a read or listing still running when the view quits. */
  stop: AbortController
}

function size(): Size {
  return { columns: process.stdout.columns, rows: process.stdout.rows }
}

function draw(app: App): void {
  const screen = size()
  const color = process.env.NO_COLOR === undefined
  const lines = frame(app.view, screen)
    .slice(0, screen.rows)
    .map((line) => paint(line, screen.columns, color))
  // Each row is cleared before it is drawn: with line wrap off, a full row leaves the
  // cursor on its last cell, which clearing after it would erase.
  process.stdout.write(`\u001b[H${lines.map((line) => `\u001b[2K${line}`).join('\r\n')}`)
}

/** Reads the logs; one read at a time, the last numbers staying on screen meanwhile. */
async function readAgain(app: App): Promise<void> {
  if (app.isReading) return
  app.isReading = true
  const { history } = app.view
  if (history.status === 'ready') {
    app.view = { ...app.view, history: { ...history, isRefreshing: true } }
  }
  draw(app)
  const result = await readLogs(app.source, app.stop.signal)
  app.isReading = false
  app.view = { ...app.view, history: afterRead(app.view.history, result) }
  draw(app)
}

/** Lists the pull requests: when the PRs tab is first shown, and on each refresh after. */
async function listAgain(app: App): Promise<void> {
  app.hasListed = true
  const prs = await listPullRequests(app.repository, app.stop.signal)
  app.view = { ...app.view, prs }
  draw(app)
}

function quit(app: App): never {
  app.stop.abort()
  process.stdin.setRawMode(false)
  process.exit(0)
}

function run(app: App, command: Command | undefined): void {
  if (command === 'quit') quit(app)
  if (command === 'refresh') {
    void readAgain(app)
    if (app.hasListed) void listAgain(app)
  }
}

function onKeys(app: App, data: Buffer): void {
  for (const key of keysIn(data.toString('utf8'))) {
    const pressed = pressKey(app.view, key, size())
    app.view = pressed.view
    run(app, pressed.command)
  }
  if (app.view.tab === 'prs' && !app.hasListed) void listAgain(app)
  draw(app)
}

export function runApp(source: Source, repository: string | undefined): void {
  const app: App = {
    view: { tab: 'today', scroll: 0, history: { status: 'loading' }, prs: { status: 'loading' } },
    source,
    repository,
    isReading: false,
    hasListed: false,
    stop: new AbortController(),
  }
  process.on('exit', () => process.stdout.write(LEAVE))
  for (const signal of ['SIGTERM', 'SIGHUP'] as const) process.on(signal, () => quit(app))
  process.stdout.write(ENTER)
  process.stdin.setRawMode(true)
  process.stdin.on('data', (data: Buffer) => {
    onKeys(app, data)
  })
  process.stdout.on('resize', () => {
    draw(app)
  })
  setInterval(() => void readAgain(app), REFRESH_MS)
  void readAgain(app)
}
