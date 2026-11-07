import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { localDay } from '../core/days.ts'
import { parsePricingPage } from '../core/price-page.ts'
import type { ModelPrice } from '../core/pricing.ts'

const PAGE = 'https://platform.claude.com/docs/en/about-claude/pricing.md'
const FETCH_TIMEOUT_MS = 10_000

const PRICES_CACHE = join(homedir(), 'Library', 'Caches', 'cost-lens', 'prices.json')

export interface LivePrices {
  /** The local day the page was fetched, YYYY-MM-DD. */
  fetched: string
  models: ModelPrice[]
}

/** The pricing page's markdown, or undefined when it cannot be fetched. */
async function fetchPricingPage(): Promise<string | undefined> {
  try {
    const response = await fetch(PAGE, {
      headers: { 'User-Agent': 'cost-lens' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return response.ok ? await response.text() : undefined
  } catch {
    return undefined
  }
}

function isRates(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const rates = value as Record<string, unknown>
  return ['input', 'write5m', 'write1h', 'read', 'output'].every(
    (key) => typeof rates[key] === 'number',
  )
}

/** The cache file is read back as untrusted data; anything malformed is ignored. */
async function readCache(path: string): Promise<LivePrices | undefined> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<LivePrices>
    const models = Array.isArray(value.models) ? (value.models as unknown[]) : []
    const isValid =
      typeof value.fetched === 'string' &&
      models.length > 0 &&
      models.every((one) => {
        const model = one as Partial<ModelPrice>
        return typeof model.id === 'string' && isRates(model.rates)
      })
    return isValid ? (value as LivePrices) : undefined
  } catch {
    return undefined
  }
}

/**
 * Today's prices: from the cache when already fetched today, else from the page (then
 * cached). When the page cannot be fetched or read, the last cached prices, else none.
 */
export async function livePrices(
  now: Date,
  path = PRICES_CACHE,
  fetchPage: () => Promise<string | undefined> = fetchPricingPage,
): Promise<LivePrices | undefined> {
  const today = localDay(now)
  const cached = await readCache(path)
  if (cached?.fetched === today) return cached
  const page = await fetchPage()
  const models = page === undefined ? undefined : parsePricingPage(page)
  if (models === undefined) return cached
  const fresh = { fetched: today, models }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(fresh))
  return fresh
}
