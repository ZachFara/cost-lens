import { ratesFor, snapshotModels } from './pricing.ts'

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

/** Each tier and the model family that fits it, cheapest first. */
const TIER_FAMILIES: readonly { tier: Tier; label: string; family: string }[] = [
  {
    tier: 'trivial',
    label: 'trivial: a quick lookup, a one-line answer, formatting or renaming',
    family: 'haiku',
  },
  {
    tier: 'routine',
    label: 'routine: everyday coding, a bug fix, tests or a small feature',
    family: 'sonnet',
  },
  {
    tier: 'complex',
    label: 'complex: careful reasoning, debugging across files, or design',
    family: 'opus',
  },
  {
    tier: 'hardest',
    label: 'hardest: long multi-step work, research, or an ambitious change',
    family: 'fable',
  },
]

/** The labels the small model chooses from, cheapest tier first. */
export const TIER_LABELS = TIER_FAMILIES.map((one) => one.label)

/** `claude-<family>-<major>[-<minor>]`; a date suffix (eight digits) is not a minor version. */
const MODEL_ID = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?$/

function version(id: string, family: string): [number, number] | undefined {
  const match = MODEL_ID.exec(id)
  if (match?.[1] !== family) return undefined
  return [Number(match[2]), Number(match[3] ?? 0)]
}

/** The newest model of a family among `ids`, by version number. */
function newestOf(family: string, ids: readonly string[]): string | undefined {
  let best: { id: string; major: number; minor: number } | undefined
  for (const id of ids) {
    const [major, minor] = version(id, family) ?? [-1, -1]
    if (major < 0) continue
    if (best === undefined || major > best.major || (major === best.major && minor > best.minor))
      best = { id, major, minor }
  }
  return best?.id
}

/** "claude-fable-5-2" reads "Fable 5.2". */
function displayName(id: string, family: string): string {
  const numbers = id.slice(`claude-${family}-`.length).replace(/-/g, '.')
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${numbers}`
}

/**
 * Each tier with the newest model of its family that Anthropic lists: `offered` is the
 * pricing page's model ids (the analyzer's summary carries them). A family missing from it,
 * or no list at all, takes the newest of the built-in price table.
 */
export function tiersFor(offered: readonly string[] = []): TierModel[] {
  return TIER_FAMILIES.flatMap(({ tier, label, family }) => {
    const model = newestOf(family, offered) ?? newestOf(family, snapshotModels())
    if (model === undefined) return []
    return [{ tier, label, model, family, alias: family, name: displayName(model, family) }]
  })
}

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
