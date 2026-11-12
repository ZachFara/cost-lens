import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { summarize } from '../../plugin/src/analyzer/logs.ts'
import { localDay } from '../../plugin/src/core/days.ts'
import type { RecentSession, Summary } from '../../plugin/src/core/summary.ts'
import { afterRead, frame, keysIn, pressKey, tabLines } from '../../plugin/src/terminal/screen.ts'
import type { Tab, View } from '../../plugin/src/terminal/screen.ts'
import { cells, paint, printable, span, spread, wrap } from '../../plugin/src/terminal/text.ts'
import type { Line } from '../../plugin/src/terminal/text.ts'

/**
 * The environment without git's own variables: a git hook (the pre-push check) exports
 * GIT_DIR, which would put the temporary folder inside this repository.
 */
function outsideGit(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')))
}

const NOW = new Date(2026, 10, 7, 12, 0)
const CLI = new URL('../../plugin/src/terminal/cli.ts', import.meta.url)

function assistant(id: string, timestamp: string, cwd: string, branch: string): string {
  const usage = { input_tokens: 1_000_000, output_tokens: 100_000 }
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    cwd,
    gitBranch: branch,
    message: { id, model: 'claude-opus-5-5', usage },
  })
}

/** A logs folder with three requests in two projects, today. */
function writeLogs(root: string, when: Date): void {
  const at = (hour: number) =>
    new Date(when.getFullYear(), when.getMonth(), when.getDate(), hour).toISOString()
  mkdirSync(join(root, 'shop'), { recursive: true })
  writeFileSync(
    join(root, 'shop', 'session.jsonl'),
    [
      assistant('msg_1', at(9), '/home/me/code/shop', 'main'),
      assistant('msg_2', at(10), '/home/me/code/shop', 'feat/cart'),
      assistant('msg_3', at(11), '/home/me/code/blog', 'main'),
    ].join('\n'),
  )
}

async function withSummary(use: (summary: Summary) => void): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-terminal-'))
  try {
    writeLogs(root, NOW)
    use(await summarize(root, NOW, { project: '/home/me/code/shop', home: '/home/me' }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** A line's text, without tones. */
function plain(line: Line): string {
  return paint(line, 1000, false)
}

function viewOf(summary: Summary, tab: Tab): View {
  return {
    tab,
    scroll: 0,
    history: afterRead({ status: 'loading' }, { summary }),
    prs: {
      status: 'ready',
      prs: [{ number: 7, title: 'Add a cart', state: 'OPEN', branch: 'feat/cart' }],
    },
    now: NOW.getTime(),
  }
}

const SIZE = { columns: 60, rows: 20 }

await test('text wraps at spaces, spreads to the width and is cut to fit', () => {
  assert.deepEqual(wrap('one two three', 7).map(plain), ['one two', 'three'])
  assert.equal(plain(spread(span('left'), span('$1.00'), 12)), 'left   $1.00')
  assert.equal(plain(spread(span('a long name'), span('$1.00'), 10)), 'a l… $1.00')
  assert.equal(paint([span('abcdef')], 4, false), 'abc…')
  assert.equal(paint([span('ok', 'success'), span('!')], 10, true), '\u001b[32mok\u001b[0m!')
  assert.equal(cells('👍🏽 done'), 6)
})

await test('control characters in text from outside cannot reach the terminal', () => {
  const title = 'Fix\u001b[2J\u001b]0;owned\u0007 it\u202e\u009b'
  const shown = paint([span(title)], 100, true)
  assert.equal(shown, 'Fix\ufffd[2J\ufffd]0;owned\ufffd it\ufffd\ufffd')
  assert.equal(printable('caf\u00e9 ok'), 'caf\u00e9 ok')
})

await test('the data tabs show what the summary holds', async () => {
  await withSummary((summary) => {
    const text = (tab: Tab) => tabLines(viewOf(summary, tab), 60).map(plain).join('\n')
    assert.match(text('today'), /^\$18\.00\n3 requests · cache hit rate 0%/)
    assert.match(text('today'), /claude-opus-5-5 +\$18\.00/)
    assert.match(text('projects'), /shop +\$12\.00\n~\/code · 2 requests · last active today 10:00/)
    assert.match(text('branches'), /Branches in ~\/code\/shop/)
    assert.match(text('branches'), /feat\/cart +\$6\.00/)
    assert.match(text('prs'), /#7 Add a cart +\$6\.00\nopen feat\/cart · 1 request$/m)
    assert.match(text('tips'), /What is contributing to your usage\?/)
  })
})

await test('the screen fills the terminal: tab rows, the tab, and a status line', async () => {
  await withSummary((summary) => {
    const lines = frame(viewOf(summary, 'today'), SIZE).map(plain)
    assert.equal(lines.length, SIZE.rows)
    assert.ok(lines.every((line) => cells(line) <= SIZE.columns))
    assert.match(lines[0] ?? '', /^cost-lens {2}1 Now {3}2 Today {3}3 30 days/)
    assert.match(lines[1] ?? '', /^ 5 Projects {3}6 Branches {3}7 PRs {3}8 Tips/)
    assert.match(lines.at(-1) ?? '', /^Read at \d\d:\d\d · prices of .+ q quit$/)
    const narrow = frame(viewOf(summary, 'today'), { columns: 30, rows: 12 }).map(plain)
    assert.equal(narrow.length, 12)
    assert.match(narrow.at(-1) ?? '', /↓ more · q quit$/)
  })
})

await test('keys switch tabs, scroll within the tab, refresh and quit', async () => {
  // Short enough that the Today tab scrolls: two tab rows, five tab lines, the status line.
  const SIZE = { columns: 60, rows: 10 }
  await withSummary((summary) => {
    const start = viewOf(summary, 'today')
    assert.equal(pressKey(start, '5', SIZE).view.tab, 'projects')
    assert.equal(pressKey(start, '9', SIZE).view.tab, 'today')
    assert.equal(pressKey(start, '\u001b[C', SIZE).view.tab, 'last30')
    assert.equal(pressKey(start, '\u001b[D', SIZE).view.tab, 'now')
    assert.equal(pressKey(viewOf(summary, 'now'), '\u001b[D', SIZE).view.tab, 'tips')
    assert.equal(pressKey(start, 'q', SIZE).command, 'quit')
    assert.equal(pressKey(start, '\u0003', SIZE).command, 'quit')
    assert.equal(pressKey(start, 'r', SIZE).command, 'refresh')
    const down = pressKey(start, '\u001b[B', SIZE).view
    assert.equal(down.scroll, 1)
    assert.equal(pressKey(down, '\u001b[A', SIZE).view.scroll, 0)
    assert.equal(pressKey(start, '\u001b[A', SIZE).view.scroll, 0)
    const bottom = pressKey(start, 'G', SIZE).view
    const length = tabLines(start, SIZE.columns).length
    assert.equal(bottom.scroll, length - 5)
    assert.equal(pressKey(bottom, '3', SIZE).view.scroll, 0)
  })
})

const MINUTE = 60 * 1000

function session(minutesAgo: number, overrides: Partial<RecentSession> = {}): RecentSession {
  return {
    title: 'Add a cart',
    path: '~/code/shop',
    model: 'claude-opus-5-5',
    lastAt: new Date(NOW.getTime() - minutesAgo * MINUTE).toISOString(),
    contextTokens: 182_300,
    cacheLifetimeMs: 60 * MINUTE,
    next: { cold: 1.82, warm: 0.09 },
    cost: 12.5,
    requests: 41,
    ...overrides,
  }
}

await test("Now lists the last day's sessions, with a warm countdown or the cold cost", async () => {
  await withSummary((summary) => {
    const sessions = [
      session(19),
      session(90, { title: '', path: '~/code/blog', next: null, requests: 1 }),
      session(30, { title: 'Spoof\u001b[2J', cacheLifetimeMs: 5 * MINUTE }),
    ]
    const view = viewOf({ ...summary, sessions }, 'now')
    const text = tabLines(view, 60).map(plain).join('\n')
    assert.match(text, /^Sessions in the last 24 hours\n\nAdd a cart +\$12\.50\n/)
    assert.match(text, /~\/code\/shop · claude-opus-5-5 · today 11:41 · 41 requests\n/)
    assert.match(text, /● cache warm · 41m left · 182\.3k context\n/)
    assert.match(text, /\nblog +\$12\.50\n/, 'an untitled session goes by its folder')
    assert.match(text, /● cache cold · next message re-writes 182\.3k tokens\n/)
    assert.match(text, /Spoof\ufffd\[2J/, 'a title cannot reach the terminal as codes')
    assert.match(
      text,
      /● cache cold · next message re-writes 182\.3k tokens ≈ \$1\.82\n {2}\(warm: \$0\.09\)/,
    )
    const later = tabLines({ ...view, now: NOW.getTime() + 30 * MINUTE }, 60).map(plain)
    assert.match(later.join('\n'), /● cache warm · 11m left/, 'the countdown follows the clock')
    const empty = tabLines(viewOf(summary, 'now'), 60).map(plain).join('\n')
    assert.match(empty, /^No Claude Code sessions in the last 24 hours\./)
    assert.match(empty, /show in the Claude\sCode pane \(\/cost-lens\)/)
  })
})

await test('what the terminal sends splits into keys', () => {
  assert.deepEqual(keysIn('\u001b[A\u001b[6~jq'), ['\u001b[A', '\u001b[6~', 'j', 'q'])
  assert.deepEqual(keysIn('12'), ['1', '2'])
})

await test('a failed refresh keeps the last numbers and says why', async () => {
  await withSummary((summary) => {
    const ready = afterRead({ status: 'loading' }, { summary })
    const failed = afterRead(ready, { error: 'disk full' })
    assert.deepEqual(failed, { ...ready, refreshError: 'disk full' })
    assert.deepEqual(afterRead({ status: 'loading' }, { error: 'disk full' }), {
      status: 'error',
      message: 'disk full',
    })
  })
})

await test('piped, cost-lens prints every tab once and exits', () => {
  const home = mkdtempSync(join(tmpdir(), 'cost-lens-home-'))
  try {
    const logs = join(home, 'logs')
    writeLogs(logs, new Date())
    // Today's prices already cached (at rates of its own), so nothing is fetched and the
    // total shows they were used: 3 × (1M input at $5 + 100k output at $25) = $22.50.
    const cache = join(home, 'Library', 'Caches', 'cost-lens')
    mkdirSync(cache, { recursive: true })
    const rates = { input: 5, write5m: 6.25, write1h: 10, read: 0.5, output: 25 }
    const models = [{ id: 'claude-opus-5-5', rates }]
    writeFileSync(
      join(cache, 'prices.json'),
      JSON.stringify({ fetched: localDay(new Date()), models }),
    )
    const output = execFileSync(process.execPath, [CLI.pathname, logs], {
      cwd: home,
      encoding: 'utf8',
      env: outsideGit({ ...process.env, HOME: home }),
    })
    const headings = ['Now', 'Today', '30 days', 'All time', 'Projects', 'Branches', 'PRs', 'Tips']
    for (const heading of headings) assert.match(output, new RegExp(`^${heading}$`, 'm'))
    assert.match(output, /^\$22\.50$/m)
    assert.match(output, /No pull requests: this folder is not in a git repository/)
    assert.ok(!output.includes('\u001b['), 'no color codes in piped output')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

await test('--help says how to use it', () => {
  const output = execFileSync(process.execPath, [CLI.pathname, '--help'], { encoding: 'utf8' })
  assert.match(output, /^Usage: cost-lens \[logs folder\]/)
})
