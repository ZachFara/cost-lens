import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ratesFor } from '../../src/core/pricing.ts'

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
