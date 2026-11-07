import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addRecord, cacheHitRate, costOf, emptyTotals, totalCost } from '../../src/core/cost.ts'
import type { UsageRecord } from '../../src/core/cost.ts'

const FABLE: UsageRecord = {
  model: 'claude-fable-5-1',
  usage: {
    input: 1_000_000,
    output: 1_000_000,
    cacheWrite5m: 1_000_000,
    cacheWrite1h: 1_000_000,
    cacheRead: 1_000_000,
  },
}

await test('a request costs each category at its rate', () => {
  assert.deepEqual(costOf(FABLE), { input: 10, output: 50, cacheWrite: 32.5, cacheRead: 0.25 })
})

await test('totals add priced requests and list unpriced models once', () => {
  const totals = emptyTotals()
  addRecord(totals, FABLE)
  addRecord(totals, { ...FABLE, model: 'mystery-model' })
  addRecord(totals, { ...FABLE, model: 'mystery-model' })
  assert.equal(totals.requests, 3)
  assert.equal(totals.unpricedRequests, 2)
  assert.deepEqual(totals.unpricedModels, ['mystery-model'])
  assert.equal(totalCost(totals.cost), 92.75)
  assert.equal(totals.tokens.cacheRead, 3_000_000)
})

await test('cache hit rate is cache reads over all prompt tokens', () => {
  assert.equal(cacheHitRate(FABLE.usage), 0.25)
  assert.equal(cacheHitRate(emptyTotals().tokens), 0)
})
