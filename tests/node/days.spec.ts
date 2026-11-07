import assert from 'node:assert/strict'
import { test } from 'node:test'

import { daysBefore, localDay } from '../../src/core/days.ts'

await test('a moment maps to its local calendar day', () => {
  assert.equal(localDay(new Date(2026, 10, 7, 0, 0)), '2026-11-07')
  assert.equal(localDay(new Date(2026, 10, 7, 23, 59)), '2026-11-07')
  assert.equal(localDay(new Date(2026, 0, 3)), '2026-01-03')
})

await test('days before counts whole calendar days, across months', () => {
  assert.equal(daysBefore('2026-11-07', '2026-11-07'), 0)
  assert.equal(daysBefore('2026-11-06', '2026-11-07'), 1)
  assert.equal(daysBefore('2026-10-31', '2026-11-01'), 1)
  assert.equal(daysBefore('2026-11-08', '2026-11-07'), -1)
})
