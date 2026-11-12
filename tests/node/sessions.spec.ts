import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { summarize } from '../../plugin/src/analyzer/logs.ts'
import { contextCost } from '../../plugin/src/core/cache.ts'

const NOW = new Date(2026, 10, 7, 12, 0)
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

interface Request {
  id: string
  session: string
  minutesAgo: number
  usage: Record<string, unknown>
  model?: string
  cwd?: string
  isSidechain?: boolean
}

function request(one: Request): string {
  return JSON.stringify({
    type: 'assistant',
    sessionId: one.session,
    isSidechain: one.isSidechain ?? false,
    timestamp: new Date(NOW.getTime() - one.minutesAgo * MINUTE).toISOString(),
    cwd: one.cwd ?? '/home/me/code/shop',
    message: { id: one.id, model: one.model ?? 'claude-opus-5-5', usage: one.usage },
  })
}

function title(session: string, type: 'ai-title' | 'custom-title', text: string): string {
  const key = type === 'ai-title' ? 'aiTitle' : 'customTitle'
  return JSON.stringify({ type, [key]: text, sessionId: session })
}

const WRITE_1H = { cache_creation: { ephemeral_1h_input_tokens: 100_000 } }

/** Three sessions: one 20 minutes ago (with a subagent), one 3 hours ago, one 2 days ago. */
function writeLogs(root: string): void {
  mkdirSync(join(root, 'shop', 'a', 'subagents'), { recursive: true })
  writeFileSync(
    join(root, 'shop', 'a.jsonl'),
    [
      title('a', 'ai-title', 'Add a cart'),
      request({ id: 'm1', session: 'a', minutesAgo: 50, usage: { input_tokens: 10, ...WRITE_1H } }),
      title('a', 'custom-title', 'Cart\u001b[2J work'),
      request({
        id: 'm2',
        session: 'a',
        minutesAgo: 20,
        model: 'claude-sonnet-5-5',
        usage: { input_tokens: 5, cache_read_input_tokens: 120_000, output_tokens: 300 },
      }),
    ].join('\n'),
  )
  writeFileSync(
    join(root, 'shop', 'a', 'subagents', 'agent-1.jsonl'),
    request({
      id: 's1',
      session: 'a',
      minutesAgo: 5,
      isSidechain: true,
      model: 'claude-haiku-5-5',
      usage: { input_tokens: 999_000 },
    }),
  )
  writeFileSync(
    join(root, 'shop', 'b.jsonl'),
    [
      request({
        id: 'm3',
        session: 'b',
        minutesAgo: 180,
        cwd: '/elsewhere/blog',
        usage: { input_tokens: 2000, cache_creation_input_tokens: 30_000 },
      }),
    ].join('\n'),
  )
  writeFileSync(
    join(root, 'shop', 'c.jsonl'),
    request({ id: 'm4', session: 'c', minutesAgo: 48 * 60, usage: { input_tokens: 1 } }),
  )
}

async function sessions() {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-sessions-'))
  try {
    writeLogs(root)
    return (await summarize(root, NOW, { home: '/home/me' })).sessions
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

await test('the last 24 hours of sessions, most recent first, as their main thread stands', async () => {
  const [first, second, ...rest] = await sessions()
  assert.equal(rest.length, 0, 'the session from two days ago is left out')
  assert.ok(first !== undefined && second !== undefined)
  // A title the person gave wins over Claude Code's own; the last main request sets the
  // model, context and time; a subagent's later request does not.
  assert.equal(first.title, 'Cart\u001b[2J work')
  assert.equal(first.path, '~/code/shop')
  assert.equal(first.model, 'claude-sonnet-5-5')
  assert.equal(first.lastAt, new Date(NOW.getTime() - 20 * MINUTE).toISOString())
  assert.equal(first.contextTokens, 120_005)
  assert.equal(first.cacheLifetimeMs, HOUR, 'the earlier one-hour write still holds')
  assert.equal(first.requests, 3, 'the subagent request counts toward the session')
  assert.ok(first.cost > 0.9, 'and so does its cost')
  assert.deepEqual(first.next, contextCost('claude-sonnet-5-5', 120_005, HOUR))

  assert.equal(second.title, '')
  assert.equal(second.path, '/elsewhere/blog')
  assert.equal(second.contextTokens, 32_000)
  assert.equal(second.cacheLifetimeMs, 5 * MINUTE, 'a write with no split is a 5-minute one')
  assert.equal(second.requests, 1)
})

await test('a model with no published price has no next-message cost', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-sessions-'))
  try {
    writeFileSync(
      join(root, 'x.jsonl'),
      request({
        id: 'm1',
        session: 'x',
        minutesAgo: 1,
        model: 'some-other-model',
        usage: { input_tokens: 10 },
      }),
    )
    const [only] = (await summarize(root, NOW, { home: '/home/me' })).sessions
    assert.ok(only !== undefined)
    assert.equal(only.next, null)
    assert.equal(only.cost, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
