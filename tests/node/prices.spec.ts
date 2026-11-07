import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { livePrices } from '../../plugin/src/analyzer/prices.ts'

const ROW = (name: string) =>
  `| Claude ${name} | $1 / MTok | $1.25 / MTok | $2 / MTok | $0.10 / MTok | $5 / MTok |`
const PAGE = ['## Model pricing', ...['A 1', 'B 1', 'C 1', 'D 1', 'E 1'].map(ROW)].join('\n')
const DAY_1 = new Date(2026, 10, 7, 9, 0)
const DAY_2 = new Date(2026, 10, 8, 9, 0)

async function withCache(use: (path: string) => Promise<void>): Promise<void> {
  const folder = mkdtempSync(join(tmpdir(), 'cost-lens-prices-'))
  try {
    await use(join(folder, 'nested', 'prices.json'))
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

await test('prices are fetched once a day and cached', async () => {
  await withCache(async (path) => {
    let fetches = 0
    const fetchPage = () => {
      fetches += 1
      return Promise.resolve(PAGE)
    }
    const first = await livePrices(DAY_1, path, fetchPage)
    assert.equal(first?.fetched, '2026-11-07')
    assert.equal(first.models.length, 5)
    await livePrices(DAY_1, path, fetchPage)
    assert.equal(fetches, 1)
    await livePrices(DAY_2, path, fetchPage)
    assert.equal(fetches, 2)
  })
})

await test('when the page cannot be fetched or read, the last cached prices stand', async () => {
  await withCache(async (path) => {
    await livePrices(DAY_1, path, () => Promise.resolve(PAGE))
    const offline = await livePrices(DAY_2, path, () => Promise.resolve(undefined))
    assert.equal(offline?.fetched, '2026-11-07')
    const changed = await livePrices(DAY_2, path, () => Promise.resolve('# a new layout'))
    assert.equal(changed?.fetched, '2026-11-07')
  })
})

await test('with no cache and no page there are no live prices; a broken cache is ignored', async () => {
  await withCache(async (path) => {
    assert.equal(await livePrices(DAY_1, path, () => Promise.resolve(undefined)), undefined)
    await livePrices(DAY_1, path, () => Promise.resolve(PAGE))
    writeFileSync(path, '{"fetched": "2026-11-07", "models": [{"id": 3}]}')
    assert.equal(await livePrices(DAY_1, path, () => Promise.resolve(undefined)), undefined)
    assert.match(readFileSync(path, 'utf8'), /"id": 3/)
  })
})
