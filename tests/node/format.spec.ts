import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  barWidths,
  formatClock,
  formatCount,
  formatShare,
  formatUsd,
} from '../../src/core/format.ts'

await test('money, counts and shares read the way people write them', () => {
  assert.equal(formatUsd(1234.5), '$1,234.50')
  assert.equal(formatCount(17123), '17,123')
  assert.equal(formatShare(0.355), '36%')
  assert.equal(formatShare(0.001), '<1%')
  assert.equal(formatShare(0), '0%')
})

await test('bar widths are proportional and always fill the bar exactly', () => {
  assert.deepEqual(barWidths([1, 1, 2], 8), [2, 2, 4])
  const widths = barWidths([0.6, 259.6, 409.3, 479.1], 60)
  assert.equal(
    widths.reduce((sum, cells) => sum + cells, 0),
    60,
  )
  assert.equal(widths[0], 0)
  assert.deepEqual(barWidths([0, 0], 10), [0, 0])
})

await test('timestamps show as local wall-clock time', () => {
  const local = new Date(2026, 10, 7, 9, 5)
  assert.equal(formatClock(local.toISOString()), '09:05')
})
