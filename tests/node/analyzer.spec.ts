import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { recordFromLine, summarize } from '../../plugin/src/analyzer/logs.ts'
import { parseSummary } from '../../plugin/src/core/summary.ts'

const NOW = new Date(2026, 10, 7, 12, 0)

function daysAgo(days: number, hour = 12): string {
  return new Date(2026, 10, 7 - days, hour, 0).toISOString()
}

function assistant(
  id: string,
  model: string,
  usage: Record<string, unknown>,
  { timestamp = daysAgo(0), cwd = '/home/me/code/shop' }: { timestamp?: string; cwd?: string } = {},
): string {
  return JSON.stringify({ type: 'assistant', timestamp, cwd, message: { id, model, usage } })
}

const ONE_MILLION_EACH = {
  input_tokens: 1_000_000,
  output_tokens: 1_000_000,
  cache_read_input_tokens: 1_000_000,
  cache_creation_input_tokens: 2_000_000,
  cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 1_000_000 },
}

/** Writes a small logs folder, hands it to `use`, and removes it afterwards. */
async function withLogs(use: (root: string) => Promise<void> | void): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-logs-'))
  try {
    mkdirSync(join(root, 'project-a', 'subagents'), { recursive: true })
    writeFileSync(
      join(root, 'project-a', 'session.jsonl'),
      [
        JSON.stringify({ type: 'user', message: { content: 'hello' } }),
        assistant('msg_1', 'claude-fable-5-1', ONE_MILLION_EACH),
        assistant('msg_1', 'claude-fable-5-1', ONE_MILLION_EACH),
        assistant('msg_2', '<synthetic>', ONE_MILLION_EACH),
        '{"usage": not json',
      ].join('\n'),
    )
    writeFileSync(
      join(root, 'project-a', 'subagents', 'agent.jsonl'),
      assistant('msg_3', 'claude-haiku-5-5', { input_tokens: 'many', output_tokens: 1_000_000 }),
    )
    writeFileSync(join(root, 'notes.txt'), assistant('msg_4', 'claude-fable-5-1', ONE_MILLION_EACH))
    await use(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

await test('a log line becomes a usage record; other lines are skipped', () => {
  const found = recordFromLine(
    assistant('msg_1', 'claude-opus-5-5', { cache_creation_input_tokens: 7 }),
  )
  assert.equal(found?.id, 'msg_1')
  assert.equal(found.record.usage.cacheWrite5m, 7)
  assert.equal(recordFromLine(JSON.stringify({ type: 'user', message: {} })), undefined)
  assert.equal(recordFromLine('not json'), undefined)
})

await test('summarize counts each message once, skips synthetic and non-log files', async () => {
  await withLogs(async (root) => {
    const summary = await summarize(root, NOW)
    assert.equal(summary.generatedAt, NOW.toISOString())
    assert.equal(summary.allTime.requests, 2)
    assert.equal(summary.allTime.unpricedRequests, 0)
    assert.equal(summary.allTime.tokens.input, 1_000_000)
    assert.deepEqual(summary.allTime.cost, {
      input: 10,
      output: 50.5,
      cacheWrite: 32.5,
      cacheRead: 0.25,
    })
  })
})

await test('a missing logs folder gives an empty summary', async () => {
  const summary = await summarize(join(tmpdir(), 'cost-lens-no-such-folder'), new Date())
  assert.equal(summary.allTime.requests, 0)
})

await test('the CLI prints a summary the mod can parse', async () => {
  await withLogs((root) => {
    const cli = ['plugin/src/analyzer/cli.ts', root]
    const output = execFileSync(process.execPath, cli, { encoding: 'utf8' })
    assert.equal(parseSummary(output)?.allTime.requests, 2)
  })
  assert.equal(parseSummary('{"allTime": {}}'), undefined)
  assert.equal(parseSummary('nope'), undefined)
})

await test('requests count toward Today and 30 days by their local calendar day', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-days-'))
  try {
    const usage = { output_tokens: 1_000_000 }
    const lines = [
      assistant('today-early', 'claude-sonnet-5-5', usage, { timestamp: daysAgo(0, 0) }),
      assistant('yesterday-late', 'claude-sonnet-5-5', usage, { timestamp: daysAgo(1, 23) }),
      assistant('day-29', 'claude-sonnet-5-5', usage, { timestamp: daysAgo(29) }),
      assistant('day-30', 'claude-sonnet-5-5', usage, { timestamp: daysAgo(30) }),
      assistant('no-time', 'claude-sonnet-5-5', usage, { timestamp: 'not a time' }),
    ]
    writeFileSync(join(root, 'session.jsonl'), lines.join('\n'))
    const summary = await summarize(root, NOW)
    assert.equal(summary.today.requests, 1)
    assert.equal(summary.last30.requests, 3)
    assert.equal(summary.allTime.requests, 5)
    assert.deepEqual(
      summary.byModel.today.map((one) => [one.model, one.requests]),
      [['claude-sonnet-5-5', 1]],
    )
    assert.equal(summary.byModel.allTime[0]?.requests, 5)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

await test('projects are the last 30 days by working folder, home written as ~', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-projects-'))
  try {
    const usage = { output_tokens: 1_000_000 }
    const sonnet = 'claude-sonnet-5-5'
    const lines = [
      assistant('a1', sonnet, usage, { timestamp: daysAgo(0, 9), cwd: '/home/me/code/shop' }),
      assistant('a2', sonnet, usage, { timestamp: daysAgo(2), cwd: '/home/me/code/shop' }),
      assistant('b1', sonnet, usage, { timestamp: daysAgo(1), cwd: '/home/me' }),
      assistant('c1', sonnet, usage, { timestamp: daysAgo(40), cwd: '/home/me/old' }),
      assistant('d1', 'mystery-model', usage, { timestamp: daysAgo(1), cwd: '/elsewhere' }),
    ]
    writeFileSync(join(root, 'session.jsonl'), lines.join('\n'))
    const summary = await summarize(root, NOW, { home: '/home/me' })
    assert.deepEqual(
      summary.projects.map((one) => [one.path, one.last30.requests, one.last30.cost.output]),
      [
        ['~/code/shop', 2, 20],
        ['~', 1, 10],
        ['/elsewhere', 1, 0],
      ],
    )
    assert.equal(summary.projects[0]?.last30.lastActive, daysAgo(0, 9))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
