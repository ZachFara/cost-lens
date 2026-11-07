import { TIERS, familyOf, priceComparison } from '../core/models.ts'
import type { TierModel } from '../core/models.ts'

/** Shorter prompts ("continue", "yes") carry on earlier work; they are not judged. */
export const MIN_PROMPT_CHARS = 40
/** At most one suggestion this often. */
const ADVICE_EVERY_MS = 10 * 60 * 1000
/** How many recent recommendations the Model tab keeps. */
export const KEPT = 5

/** The labels the small model chooses from. */
export const TIER_LABELS = TIERS.map((one) => one.label)

/** The tier the classifier named, or undefined when it named none. */
export function tierOf(answer: string | undefined): TierModel | undefined {
  return TIERS.find((one) => one.label === answer)
}

/** Whether to suggest `fit` to someone on `current` now, given the last suggestion's time. */
export function shouldSuggest(fit: TierModel, current: string, now: number, lastAt: number) {
  return familyOf(current) !== fit.family && now - lastAt >= ADVICE_EVERY_MS
}

export function adviceText(fit: TierModel, current: string): string {
  const comparison = priceComparison(current, fit.model)
  const cheaper = comparison?.endsWith('less per token') === true
  const why = cheaper
    ? `${fit.name} fits, at ${comparison}`
    : `${fit.name} may do it better${comparison === undefined ? '' : `, at ${comparison}`}`
  return `cost-lens: this looks ${fit.tier} (${fit.label.split(': ')[1] ?? ''}). ${why}. /model ${fit.alias}`
}
