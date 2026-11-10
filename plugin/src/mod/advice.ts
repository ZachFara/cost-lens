import { familyOf, priceComparison, tiersFor } from '../core/models.ts'
import type { TierModel } from '../core/models.ts'
import type { History } from '../../types'

/** Shorter prompts ("continue", "yes") carry on earlier work; they are not judged. */
export const MIN_PROMPT_CHARS = 40
/** At most one suggestion this often. */
const ADVICE_EVERY_MS = 10 * 60 * 1000
/** How many recent recommendations the Model tab keeps. */
export const KEPT = 5

export { TIER_LABELS } from '../core/models.ts'

/** Each tier's model: the newest the last summary's pricing page lists, else the snapshot's. */
export function currentTiers(history: History): TierModel[] {
  return tiersFor(history.status === 'ready' ? history.summary.models : [])
}

/** The tier the classifier named, with its current model, or undefined when it named none. */
export function tierOf(answer: string | undefined, history: History) {
  return currentTiers(history).find((one) => one.label === answer)
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
