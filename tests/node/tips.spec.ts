import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { summarize } from '../../src/analyzer/logs.ts'
import type { UsageRecord } from '../../src/core/cost.ts'
import { cacheLifetimeMs, coldRebuildWaste, isLargeContext } from '../../src/core/tips.ts'

const HOUR = 60 * 60 * 1000

function opus(usage: Partial<UsageRecord['usage']>): UsageRecord {
  return {
    model: 'claude-opus-5-5',
    usage: { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, ...usage },
  }
}

await test('a cache lives an hour or five minutes, as its last write said', () => {
  assert.equal(cacheLifetimeMs(opus({ cacheWrite1h: 10 }), 0), HOUR)
  assert.equal(cacheLifetimeMs(opus({ cacheWrite5m: 10 }), HOUR), 5 * 60 * 1000)
  assert.equal(cacheLifetimeMs(opus({ cacheRead: 10 }), HOUR), HOUR)
})

await test('a cold rebuild costs its writes minus what reading them would have', () => {
  const rebuild = opus({ cacheWrite1h: 1_000_000, cacheRead: 0 })
  assert.equal(coldRebuildWaste(rebuild, 2 * HOUR, HOUR), 8 - 0.2)
  assert.equal(coldRebuildWaste(rebuild, HOUR / 2, HOUR), 0)
  assert.equal(coldRebuildWaste(opus({ cacheWrite1h: 4000 }), 2 * HOUR, HOUR), 0)
  assert.equal(
    coldRebuildWaste(opus({ cacheWrite1h: 10_000, cacheRead: 50_000 }), 2 * HOUR, HOUR),
    0,
  )
  assert.equal(isLargeContext(opus({ cacheRead: 150_001 })), true)
  assert.equal(isLargeContext(opus({ cacheRead: 150_000 })), false)
})

function line(
  id: string,
  at: Date,
  usage: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    type: 'assistant',
    timestamp: at.toISOString(),
    ...extra,
    message: { id, model: 'claude-opus-5-5', usage, content: extra.content ?? [] },
  })
}

await test('the analyzer finds cold rebuilds, large context, and what skills and MCP servers cost', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cost-lens-tips-'))
  try {
    const now = new Date(2026, 10, 7, 12, 0)
    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR)
    const warmWrite = {
      cache_creation_input_tokens: 200_000,
      cache_creation: { ephemeral_1h_input_tokens: 200_000, ephemeral_5m_input_tokens: 0 },
    }
    const skill = { type: 'tool_use', name: 'Skill', input: { skill: 'anthropic-skills:docs' } }
    const mcp = { type: 'tool_use', name: 'mcp__claude_ai_Linear__list_issues', input: {} }
    const lines = [
      line('m1', at(5), warmWrite),
      line('m2', at(2), warmWrite, { content: [{ type: 'text', text: 'hi' }] }),
      line('m2', at(2), warmWrite, { content: [skill] }),
      line('m3', at(1.9), { output_tokens: 1_000_000 }, { content: [mcp] }),
      line('s1', at(1), warmWrite, { isSidechain: true }),
    ]
    writeFileSync(join(root, 'session.jsonl'), lines.join('\n'))
    const { tips, cacheLifetimeMs } = await summarize(root, now)

    assert.equal(tips.last30.coldRebuilds, 1)
    assert.ok(Math.abs(tips.last30.coldWaste - (200_000 * (8 - 0.2)) / 1_000_000) < 1e-9)
    assert.equal(tips.last24h.largeContextCost, tips.last30.largeContextCost)
    assert.ok(tips.last24h.largeContextCost > 0)
    assert.deepEqual(
      tips.last24h.skills.map((one) => one.name),
      ['anthropic-skills:docs'],
    )
    assert.deepEqual(tips.last24h.mcpServers, [{ name: 'claude_ai_Linear', cost: 20 }])
    assert.equal(cacheLifetimeMs, HOUR)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
