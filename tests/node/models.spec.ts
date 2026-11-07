import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TIERS, familyOf, priceComparison } from '../../plugin/src/core/models.ts'

await test('model ids and aliases map to families; Mythos counts as Fable', () => {
  assert.equal(familyOf('claude-opus-5-5'), 'opus')
  assert.equal(familyOf('sonnet'), 'sonnet')
  assert.equal(familyOf('claude-mythos-5-1'), 'fable')
  assert.equal(familyOf('gpt-5'), undefined)
})

await test('a recommendation is priced against the current model, in either direction', () => {
  assert.equal(priceComparison('claude-opus-5-5', 'claude-sonnet-5-5'), '2x less per token')
  assert.equal(priceComparison('claude-sonnet-5-5', 'claude-opus-5-5'), '2x the price per token')
  assert.equal(priceComparison('claude-fable-5-1', 'claude-haiku-5-5'), '100x less per token')
  assert.equal(priceComparison('mystery', 'claude-opus-5-5'), undefined)
})

await test('tiers run from cheapest to most capable, each with a priced model', () => {
  assert.deepEqual(
    TIERS.map((one) => one.tier),
    ['trivial', 'routine', 'complex', 'hardest'],
  )
  for (const one of TIERS) assert.equal(familyOf(one.model), one.family)
})
