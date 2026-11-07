import type { Totals } from './cost.ts'

/** What the analyzer prints and the mod reads. */
export interface Summary {
  generatedAt: string
  pricesFetched: string
  allTime: Totals
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasNumbers(value: unknown, keys: readonly string[]): boolean {
  return isObject(value) && keys.every((key) => typeof value[key] === 'number')
}

function isTotals(value: unknown): value is Totals {
  return (
    hasNumbers(value, ['requests', 'unpricedRequests']) &&
    isObject(value) &&
    Array.isArray(value.unpricedModels) &&
    value.unpricedModels.every((model) => typeof model === 'string') &&
    hasNumbers(value.tokens, ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead']) &&
    hasNumbers(value.cost, ['input', 'output', 'cacheWrite', 'cacheRead'])
  )
}

/** Reads the analyzer's output; anything that is not a well-formed summary is rejected. */
export function parseSummary(text: string): Summary | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isObject(value) || !isTotals(value.allTime)) return undefined
  if (typeof value.generatedAt !== 'string' || typeof value.pricesFetched !== 'string') {
    return undefined
  }
  return {
    generatedAt: value.generatedAt,
    pricesFetched: value.pricesFetched,
    allTime: value.allTime,
  }
}
