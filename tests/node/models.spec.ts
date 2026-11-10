import assert from 'node:assert/strict'
import { test } from 'node:test'

import { familyOf, priceComparison, tiersFor } from '../../plugin/src/core/models.ts'

await test('model ids and aliases map to families; Mythos counts as Fable', () => {
  assert.equal(familyOf('claude-opus-5-5'), 'opus')
  assert.equal(familyOf('sonnet'), 'sonnet')
  assert.equal(familyOf('claude-mythos-5-1'), 'fable')
  assert.equal(familyOf('gpt-5'), undefined)
})

await test('a recommendation is priced against the current model, in either direction', () => {
  assert.equal(priceComparison('claude-opus-5-5', 'claude-sonnet-5-5'), '2x less per token')
  assert.equal(priceComparison('claude-sonnet-5-5', 'claude-opus-5-5'), '2x the price per token')
  assert.equal(priceComparison('claude-fable-5-2', 'claude-haiku-5-5'), '80x less per token')
  assert.equal(priceComparison('mystery', 'claude-opus-5-5'), undefined)
})

await test('tiers run from cheapest to most capable, each with a priced model', () => {
  const tiers = tiersFor()
  assert.deepEqual(
    tiers.map((one) => one.tier),
    ['trivial', 'routine', 'complex', 'hardest'],
  )
  for (const one of tiers) assert.equal(familyOf(one.model), one.family)
})

await test('without a fresh model list each tier takes the newest model of the built-in table', () => {
  assert.deepEqual(
    tiersFor().map((one) => [one.model, one.name]),
    [
      ['claude-haiku-5-5', 'Haiku 5.5'],
      ['claude-sonnet-5-5', 'Sonnet 5.5'],
      ['claude-opus-5-5', 'Opus 5.5'],
      ['claude-fable-5-2', 'Fable 5.2'],
    ],
  )
})

await test('each tier takes the newest model Anthropic lists in its family', () => {
  const offered = [
    'claude-fable-5-2',
    'claude-mythos-6',
    'claude-fable-6',
    'claude-opus-5-5',
    'claude-opus-5-10',
    'claude-opus-4-20250514',
    'claude-sonnet-5-5',
    'claude-haiku-4-5',
    'claude-haiku-5-5',
  ]
  assert.deepEqual(
    tiersFor(offered).map((one) => [one.model, one.name, one.alias]),
    [
      ['claude-haiku-5-5', 'Haiku 5.5', 'haiku'],
      ['claude-sonnet-5-5', 'Sonnet 5.5', 'sonnet'],
      ['claude-opus-5-10', 'Opus 5.10', 'opus'],
      ['claude-fable-6', 'Fable 6', 'fable'],
    ],
  )
})

await test('a family missing from the list keeps the built-in table newest', () => {
  const tiers = tiersFor(['claude-fable-5-3'])
  assert.equal(tiers.find((one) => one.tier === 'hardest')?.name, 'Fable 5.3')
  assert.equal(tiers.find((one) => one.tier === 'routine')?.model, 'claude-sonnet-5-5')
})
