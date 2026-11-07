import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePricingPage } from '../../src/core/price-page.ts'
import { pricesFetched, ratesFor, usePrices } from '../../src/core/pricing.ts'

// Rows copied from https://platform.claude.com/docs/en/about-claude/pricing.md (2026-11-07).
const PAGE = `
## Model pricing

| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok<sup>1</sup> | $50 / MTok |
| Claude Mythos 5.1 ([limited availability](https://support.claude.com/en/articles/14604842)) | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok<sup>1</sup> | $50 / MTok |
| Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok<sup>2</sup> | $20 / MTok |
| Claude Sonnet 5 | $2 / MTok<sup>3</sup> | $2.50 / MTok | $4 / MTok | $0.20 / MTok | $10 / MTok<sup>3</sup> |
| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |
| Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 / MTok | $0.625 / MTok | $1 / MTok | $0.05 / MTok | $2.50 / MTok |
| Claude Broken 1 | contact sales | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok |

## Batch processing

| Claude Opus 5.5 | $2 / MTok | $10 / MTok |
`

await test('the model pricing table is read row by row, notes and footnotes ignored', () => {
  const models = parsePricingPage(PAGE)
  assert.deepEqual(
    models?.map((one) => one.id),
    [
      'claude-fable-5-1',
      'claude-mythos-5-1',
      'claude-opus-5-5',
      'claude-sonnet-5',
      'claude-haiku-5-5',
    ],
  )
  assert.deepEqual(models.find((one) => one.id === 'claude-sonnet-5')?.rates, {
    input: 2,
    write5m: 2.5,
    write1h: 4,
    read: 0.2,
    output: 10,
  })
  assert.equal(models.find((one) => one.id === 'claude-haiku-5-5')?.longPrompt?.input, 0.5)
})

await test('a page without the table, or with too few models, is rejected', () => {
  assert.equal(parsePricingPage('# Pricing\n\nNothing here.'), undefined)
  assert.equal(parsePricingPage(PAGE.split('| Claude Sonnet 5 ')[0] ?? ''), undefined)
})

await test('prices from the page replace the snapshot and keep fast-mode rates', () => {
  const models = parsePricingPage(
    PAGE.replace('| Claude Opus 5.5 | $4 / MTok', '| Claude Opus 5.5 | $3 / MTok'),
  )
  assert.ok(models)
  usePrices(models, '2026-12-01')
  assert.equal(pricesFetched(), '2026-12-01')
  assert.equal(ratesFor({ model: 'claude-opus-5-5', promptTokens: 1 })?.input, 3)
  assert.equal(ratesFor({ model: 'claude-opus-5-5', promptTokens: 1, speed: 'fast' })?.input, 8)
  assert.equal(ratesFor({ model: 'claude-haiku-4-5', promptTokens: 1 }), undefined)
})
