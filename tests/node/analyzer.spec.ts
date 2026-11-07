import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { recordFromLine, summarize } from '../../src/analyzer/logs.ts'
import { parseSummary } from '../../src/core/summary.ts'

function assistant(id: string, model: string, usage: Record<string, unknown>): string {
  return JSON.stringify({ type: 'assistant', message: { id, model, usage } })
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
    const summary = await summarize(root, new Date('2026-11-07T12:00:00Z'))
    assert.equal(summary.generatedAt, '2026-11-07T12:00:00.000Z')
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
    const cli = ['src/analyzer/cli.ts', root]
    const output = execFileSync(process.execPath, cli, { encoding: 'utf8' })
    assert.equal(parseSummary(output)?.allTime.requests, 2)
  })
  assert.equal(parseSummary('{"allTime": {}}'), undefined)
  assert.equal(parseSummary('nope'), undefined)
})
