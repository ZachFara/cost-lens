import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addRecord,
  addToModel,
  cacheHitRate,
  costOf,
  emptyTotals,
  rankModels,
  totalCost,
} from '../../src/core/cost.ts'
import type { ModelTotals } from '../../src/core/cost.ts'
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

await test('models are totalled separately and ranked by cost, unpriced last', () => {
  const byModel = new Map<string, ModelTotals>()
  const sonnet = { ...FABLE, model: 'claude-sonnet-5-5' }
  addToModel(byModel, sonnet)
  addToModel(byModel, FABLE)
  addToModel(byModel, { ...FABLE, model: 'mystery-model' })
  addToModel(byModel, { ...FABLE, model: 'mystery-model' })
  const ranked = rankModels(byModel)
  assert.deepEqual(
    ranked.map((one) => [one.model, one.requests, one.isPriced]),
    [
      ['claude-fable-5-1', 1, true],
      ['claude-sonnet-5-5', 1, true],
      ['mystery-model', 2, false],
    ],
  )
  assert.equal(totalCost(ranked[2]?.cost ?? emptyTotals().cost), 0)
})
