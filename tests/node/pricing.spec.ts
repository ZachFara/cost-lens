import assert from 'node:assert/strict'
import { test } from 'node:test'

import { summarize } from '../../plugin/src/analyzer/logs.ts'
import { contextCost } from '../../plugin/src/core/cache.ts'
import { costOf, emptyTotals, plusRecord } from '../../plugin/src/core/cost.ts'
import { priceComparison } from '../../plugin/src/core/models.ts'
import { pricesInUse, ratesFor } from '../../plugin/src/core/pricing.ts'

await test('published models get their published rates', () => {
  assert.deepEqual(ratesFor({ model: 'claude-fable-5-1', promptTokens: 1000 }), {
    input: 10,
    write5m: 12.5,
    write1h: 20,
    read: 0.25,
    output: 50,
  })
  assert.equal(ratesFor({ model: 'claude-sonnet-5-5', promptTokens: 1000 })?.read, 0.1)
  assert.equal(ratesFor({ model: 'claude-sonnet-5', promptTokens: 1000 })?.read, 0.2)
})

await test('date suffixes and bracketed tags still match; unknown models are unpriced', () => {
  assert.equal(ratesFor({ model: 'claude-opus-4-20250514', promptTokens: 1 })?.input, 15)
  assert.equal(ratesFor({ model: 'claude-opus-5-5[1m]', promptTokens: 1 })?.input, 4)
  assert.equal(ratesFor({ model: 'claude-opus-4-9', promptTokens: 1 }), undefined)
  assert.equal(ratesFor({ model: 'gpt-5', promptTokens: 1 }), undefined)
})

await test('Haiku 5.5 prompts over 100,000 tokens pay the long-prompt rates', () => {
  assert.equal(ratesFor({ model: 'claude-haiku-5-5', promptTokens: 100_000 })?.input, 0.1)
  assert.equal(ratesFor({ model: 'claude-haiku-5-5', promptTokens: 100_001 })?.input, 0.5)
})

await test('fast mode replaces input and output; cache prices scale with input', () => {
  const fast = ratesFor({ model: 'claude-opus-5-5', promptTokens: 1, speed: 'fast' })
  assert.deepEqual(fast, { input: 8, write5m: 10, write1h: 16, read: 0.4, output: 40 })
  assert.equal(ratesFor({ model: 'claude-sonnet-5-5', promptTokens: 1, speed: 'fast' })?.input, 2)
})

await test('US-only inference multiplies every category by 1.1', () => {
  const us = ratesFor({ model: 'claude-opus-5-5', promptTokens: 1, geo: 'us' })
  assert.ok(us)
  assert.ok(Math.abs(us.input - 4.4) < 1e-9)
  assert.ok(Math.abs(us.output - 22) < 1e-9)
  assert.equal(ratesFor({ model: 'claude-opus-5-5', promptTokens: 1, geo: 'global' })?.input, 4)
})

await test('estimates take a price table; the summary carries the one in use', async () => {
  const rates = { input: 8, write5m: 10, write1h: 16, read: 0.4, output: 40 }
  const table = [{ id: 'claude-opus-5-5', rates }]
  assert.equal(ratesFor({ model: 'claude-opus-5-5', promptTokens: 1 }, table)?.input, 8)
  assert.equal(ratesFor({ model: 'claude-sonnet-5-5', promptTokens: 1 }, table), undefined)
  assert.equal(contextCost('claude-opus-5-5', 1_000_000, 60 * 60 * 1000, table)?.cold, 16)
  const usage = { input: 1_000_000, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 }
  assert.equal(costOf({ model: 'claude-opus-5-5', usage }, table)?.input, 8)
  assert.equal(plusRecord(emptyTotals(), { model: 'claude-opus-5-5', usage }, table).cost.input, 8)
  assert.equal(priceComparison('claude-opus-5-5', 'claude-sonnet-5-5', table), undefined)
  const summary = await summarize('/nonexistent/cost-lens-logs', new Date())
  assert.deepEqual(summary.prices, pricesInUse())
  assert.deepEqual(
    summary.prices.find((one) => one.id === 'claude-opus-5-5')?.fast,
    { input: 8, output: 40 },
    'fast-mode rates travel with the table',
  )
})
