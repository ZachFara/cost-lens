/**
 * US dollars per million tokens, copied from Anthropic's pricing page
 * (https://platform.claude.com/docs/en/about-claude/pricing.md). Decision 0006.
 */
const PRICES_FETCHED = '2026-11-10'

export interface Rates {
  input: number
  write5m: number
  write1h: number
  read: number
  output: number
}

export interface ModelPrice {
  id: string
  rates: Rates
  /** Claude Haiku 5.5: rates for a request whose whole prompt is over 100,000 tokens. */
  longPrompt?: Rates
  /** Fast mode replaces input and output prices; cache prices scale with input. */
  fast?: { input: number; output: number }
}

export interface PricedRequest {
  model: string
  promptTokens: number
  speed?: string | undefined
  geo?: string | undefined
}

const LONG_PROMPT_TOKENS = 100_000
const US_ONLY_MULTIPLIER = 1.1

/** One row of the pricing page: base input, 5m cache write, 1h cache write, cache hit, output. */
function rates([input, write5m, write1h, read, output]: readonly [
  number,
  number,
  number,
  number,
  number,
]): Rates {
  return { input, write5m, write1h, read, output }
}

const OPUS_4X = rates([5, 6.25, 10, 0.5, 25])
const OPUS_4_LEGACY = rates([15, 18.75, 30, 1.5, 75])
const SONNET_4X = rates([3, 3.75, 6, 0.3, 15])

const SNAPSHOT: readonly ModelPrice[] = [
  { id: 'claude-fable-5-2', rates: rates([8, 10, 16, 0.2, 40]) },
  { id: 'claude-mythos-5-2', rates: rates([8, 10, 16, 0.2, 40]) },
  { id: 'claude-fable-5-1', rates: rates([10, 12.5, 20, 0.25, 50]) },
  { id: 'claude-mythos-5-1', rates: rates([10, 12.5, 20, 0.25, 50]) },
  { id: 'claude-fable-5', rates: rates([10, 12.5, 20, 1, 50]) },
  { id: 'claude-mythos-5', rates: rates([10, 12.5, 20, 1, 50]) },
  { id: 'claude-opus-5-5', rates: rates([4, 5, 8, 0.2, 20]), fast: { input: 8, output: 40 } },
  { id: 'claude-opus-5', rates: OPUS_4X, fast: { input: 10, output: 50 } },
  { id: 'claude-opus-4-8', rates: OPUS_4X, fast: { input: 10, output: 50 } },
  { id: 'claude-opus-4-7', rates: OPUS_4X },
  { id: 'claude-opus-4-6', rates: OPUS_4X },
  { id: 'claude-opus-4-5', rates: OPUS_4X },
  { id: 'claude-opus-4-1', rates: OPUS_4_LEGACY },
  { id: 'claude-opus-4', rates: OPUS_4_LEGACY },
  { id: 'claude-sonnet-5-5', rates: rates([2, 2.5, 4, 0.1, 10]) },
  { id: 'claude-sonnet-5', rates: rates([2, 2.5, 4, 0.2, 10]) },
  { id: 'claude-sonnet-4-6', rates: SONNET_4X },
  { id: 'claude-sonnet-4-5', rates: SONNET_4X },
  { id: 'claude-sonnet-4', rates: SONNET_4X },
  {
    id: 'claude-haiku-5-5',
    rates: rates([0.1, 0.125, 0.2, 0.01, 0.5]),
    longPrompt: rates([0.5, 0.625, 1, 0.05, 2.5]),
  },
  { id: 'claude-haiku-4-5', rates: rates([1, 1.25, 2, 0.1, 5]) },
]

/** A model id names a priced model exactly, or with a date suffix and/or a bracketed tag. */
const SUFFIX = /^(-\d{8})?(\[[^\]]*\])?$/

let table: readonly ModelPrice[] = SNAPSHOT
let tableFetched = PRICES_FETCHED

/**
 * Prices from a fresh copy of the pricing page (decision 0006), with fast-mode rates kept
 * from the built-in snapshot, which the page lists in a separate table.
 */
export function usePrices(models: readonly ModelPrice[], fetched: string): void {
  const fastOf = new Map(SNAPSHOT.map((one) => [one.id, one.fast]))
  table = models.map((one) => {
    const fast = fastOf.get(one.id)
    return fast === undefined ? one : { ...one, fast }
  })
  tableFetched = fetched
}

/** The ids of the models the price table in use lists: today's page, else the snapshot. */
export function offeredModels(): string[] {
  return table.map((one) => one.id)
}

/** The ids of the built-in snapshot's models. */
export function snapshotModels(): string[] {
  return SNAPSHOT.map((one) => one.id)
}

/** The date of the prices in use: the snapshot's, or the day they were fetched. */
export function pricesFetched(): string {
  return tableFetched
}

function modelPrice(model: string): ModelPrice | undefined {
  return table.find((one) => model.startsWith(one.id) && SUFFIX.test(model.slice(one.id.length)))
}

function scale(base: Rates, inputFactor: number, outputFactor: number): Rates {
  return {
    input: base.input * inputFactor,
    write5m: base.write5m * inputFactor,
    write1h: base.write1h * inputFactor,
    read: base.read * inputFactor,
    output: base.output * outputFactor,
  }
}

/** The rates one request is billed at, or undefined for a model with no published price. */
export function ratesFor(request: PricedRequest): Rates | undefined {
  const price = modelPrice(request.model)
  if (price === undefined) return undefined
  const isLong = request.promptTokens > LONG_PROMPT_TOKENS
  let billed = isLong && price.longPrompt ? price.longPrompt : price.rates
  if (request.speed === 'fast' && price.fast) {
    billed = scale(billed, price.fast.input / billed.input, price.fast.output / billed.output)
  }
  if (request.geo === 'us') billed = scale(billed, US_ONLY_MULTIPLIER, US_ONLY_MULTIPLIER)
  return billed
}
