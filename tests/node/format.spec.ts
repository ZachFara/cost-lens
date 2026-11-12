import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  barWidths,
  formatClock,
  formatCount,
  formatRequests,
  formatResets,
  formatShare,
  formatTokens,
  formatUsd,
  formatWhen,
} from '../../plugin/src/core/format.ts'

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

await test('last active reads as a time today, or a date before', () => {
  const now = new Date(2026, 10, 7, 15, 0)
  assert.equal(formatWhen(new Date(2026, 10, 7, 9, 30).toISOString(), now), 'today 09:30')
  assert.equal(formatWhen(new Date(2026, 10, 5, 23, 0).toISOString(), now), 'Nov 5')
  assert.equal(formatWhen('', now), '')
})

await test('token counts read short, and reset times read like /usage', () => {
  assert.equal(formatTokens(950), '950')
  assert.equal(formatTokens(12_345), '12.3k')
  assert.equal(formatTokens(1_234_567), '1.2M')
  const now = new Date(2026, 10, 7, 11, 0)
  assert.equal(formatResets(new Date(2026, 10, 7, 12, 40).toISOString(), now), 'Resets 12:40')
  assert.equal(
    formatResets(new Date(2026, 10, 12, 22, 59).toISOString(), now),
    'Resets Nov 12 at 22:59',
  )
})

await test('a request count takes its noun in the singular for one', () => {
  assert.equal(formatRequests(1), '1 request')
  assert.equal(formatRequests(0), '0 requests')
  assert.equal(formatRequests(1234), '1,234 requests')
})
