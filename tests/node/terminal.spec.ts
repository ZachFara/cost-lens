import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { summarize } from '../../plugin/src/analyzer/logs.ts'
import { localDay } from '../../plugin/src/core/days.ts'
import type { Summary } from '../../plugin/src/core/summary.ts'
import { afterRead, frame, keysIn, pressKey, tabLines } from '../../plugin/src/terminal/screen.ts'
import type { Tab, View } from '../../plugin/src/terminal/screen.ts'
import { cells, paint, span, spread, wrap } from '../../plugin/src/terminal/text.ts'
import type { Line } from '../../plugin/src/terminal/text.ts'

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

await test('the data tabs show what the summary holds', async () => {
  await withSummary((summary) => {
    const text = (tab: Tab) => tabLines(viewOf(summary, tab), 60).map(plain).join('\n')
    assert.match(text('today'), /^\$18\.00\n3 requests · cache hit rate 0%/)
    assert.match(text('today'), /claude-opus-5-5 +\$18\.00/)
    assert.match(text('projects'), /shop +\$12\.00\n~\/code · 2 requests · last active today 10:00/)
    assert.match(text('branches'), /Branches in ~\/code\/shop/)
    assert.match(text('branches'), /feat\/cart +\$6\.00/)
    assert.match(text('prs'), /#7 Add a cart +\$6\.00\nopen feat\/cart · 1 requests/)
    assert.match(text('tips'), /What is contributing to your usage\?/)
  })
})

await test('the screen fills the terminal: tab rows, the tab, and a status line', async () => {
  await withSummary((summary) => {
    const lines = frame(viewOf(summary, 'today'), SIZE).map(plain)
    assert.equal(lines.length, SIZE.rows)
    assert.ok(lines.every((line) => cells(line) <= SIZE.columns))
    assert.match(lines[0] ?? '', /^cost-lens {2}1 Today {3}2 30 days/)
    assert.match(lines[1] ?? '', /^ 5 Branches {3}6 PRs {3}7 Tips/)
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
    assert.equal(pressKey(start, '4', SIZE).view.tab, 'projects')
    assert.equal(pressKey(start, '9', SIZE).view.tab, 'today')
    assert.equal(pressKey(start, '\u001b[C', SIZE).view.tab, 'last30')
    assert.equal(pressKey(start, '\u001b[D', SIZE).view.tab, 'tips')
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
    assert.equal(pressKey(bottom, '2', SIZE).view.scroll, 0)
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
      env: { ...process.env, HOME: home },
    })
    const headings = ['Today', '30 days', 'All time', 'Projects', 'Branches', 'PRs', 'Tips']
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
