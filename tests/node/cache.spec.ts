import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cacheMsLeft, contextCost } from '../../src/core/cache.ts'
import { formatDuration } from '../../src/core/format.ts'

const HOUR = 60 * 60 * 1000

await test('the cache counts down from the last request', () => {
  assert.equal(cacheMsLeft(10 * HOUR, 9.5 * HOUR, HOUR), HOUR / 2)
  assert.ok(cacheMsLeft(10 * HOUR, 8 * HOUR, HOUR) < 0)
})

await test('a cold message re-writes its context; a warm one reads it', () => {
  const hour = contextCost('claude-opus-5-5', 1_000_000, HOUR)
  assert.deepEqual(hour, { cold: 8, warm: 0.2 })
  assert.equal(contextCost('claude-opus-5-5', 1_000_000, 5 * 60 * 1000)?.cold, 5)
  assert.equal(contextCost('mystery-model', 1, HOUR), undefined)
})

await test('durations read short', () => {
  assert.equal(formatDuration(30 * 1000), '<1m')
  assert.equal(formatDuration(41 * 60 * 1000 + 59 * 1000), '41m')
  assert.equal(formatDuration(65 * 60 * 1000), '1h 5m')
})
