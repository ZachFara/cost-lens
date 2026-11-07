import { ratesFor } from './pricing.ts'

type Tier = 'trivial' | 'routine' | 'complex' | 'hardest'

export interface TierModel {
  tier: Tier
  /** What the classifier is asked to recognize. */
  label: string
  /** The model id it recommends, its family, the `/model` alias and a display name. */
  model: string
  family: string
  alias: string
  name: string
}

/** Each tier and the cheapest current model that fits it, cheapest first. */
export const TIERS: readonly TierModel[] = [
  {
    tier: 'trivial',
    label: 'trivial: a quick lookup, a one-line answer, formatting or renaming',
    model: 'claude-haiku-5-5',
    family: 'haiku',
    alias: 'haiku',
    name: 'Haiku 5.5',
  },
  {
    tier: 'routine',
    label: 'routine: everyday coding, a bug fix, tests or a small feature',
    model: 'claude-sonnet-5-5',
    family: 'sonnet',
    alias: 'sonnet',
    name: 'Sonnet 5.5',
  },
  {
    tier: 'complex',
    label: 'complex: careful reasoning, debugging across files, or design',
    model: 'claude-opus-5-5',
    family: 'opus',
    alias: 'opus',
    name: 'Opus 5.5',
  },
  {
    tier: 'hardest',
    label: 'hardest: long multi-step work, research, or an ambitious change',
    model: 'claude-fable-5-1',
    family: 'fable',
    alias: 'fable',
    name: 'Fable 5.1',
  },
]

/** The model family of an id or alias: haiku, sonnet, opus or fable (Mythos counts as Fable). */
export function familyOf(model: string): string | undefined {
  const found = /haiku|sonnet|opus|fable|mythos/i.exec(model)?.[0].toLowerCase()
  return found === 'mythos' ? 'fable' : found
}

/** How a recommended model's input price compares with the current one's, e.g. "2x less". */
export function priceComparison(current: string, recommended: string): string | undefined {
  const now = ratesFor({ model: current, promptTokens: 0 })?.input
  const next = ratesFor({ model: recommended, promptTokens: 0 })?.input
  if (now === undefined || next === undefined || now === next) return undefined
  return now > next
    ? `${String(Math.round(now / next))}x less per token`
    : `${String(Math.round(next / now))}x the price per token`
}
