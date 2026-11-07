import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { TIERS, familyOf, priceComparison } from '../core/models.ts'
import type { TierModel } from '../core/models.ts'
import type { Recommendation } from '../../types'

import type { Settings } from './settings.ts'

// Change a tag when its value's fields change: it declines what an earlier version stored.
// Newest first; only the tier, models and time are kept, never the prompt's text.
const recommendations = atom({ plugin: 'cost-lens', key: 'recommendations' } as const, [], {
  shape: 'recommendations-1',
})
const lastAdviceAt = atom({ plugin: 'cost-lens', key: 'lastAdviceAt' } as const, 0)

const ADVICE_EVERY_MS = 10 * 60 * 1000
const KEPT = 5
/** Shorter prompts ("continue", "yes") carry on earlier work; they are not judged. */
const MIN_PROMPT_CHARS = 40

/** This session's recommendations, newest first; reads stay in this file. */
export function readRecommendations($: EngineInterface): Promise<Recommendation[]> {
  return read($, recommendations)
}

function adviceText(fit: TierModel, current: string): string {
  const comparison = priceComparison(current, fit.model)
  const cheaper = comparison?.endsWith('less per token') === true
  const why = cheaper
    ? `${fit.name} fits, at ${comparison}`
    : `${fit.name} may do it better${comparison === undefined ? '' : `, at ${comparison}`}`
  return `cost-lens: this looks ${fit.tier} (${fit.label.split(': ')[1] ?? ''}). ${why}. /model ${fit.alias}`
}

async function notify($: EngineInterface, fit: TierModel, current: string, now: number) {
  if (familyOf(current) === fit.family) return
  if (now - (await read($, lastAdviceAt)) < ADVICE_EVERY_MS) return
  await update($, lastAdviceAt, () => now)
  $.ui.toast(adviceText(fit, current), { timeoutMs: 10_000 })
}

/**
 * With LLM features on, after a typed prompt has entered, the small fast model judges
 * which tier it is; the Model tab shows the fitting model, and, with notifications on,
 * a toast suggests it when it is not the current model's family, at most once every ten
 * minutes. With LLM features off nothing is sent. Never throws.
 */
export async function adviseModel($: EngineInterface, text: string, settings: Settings) {
  if (!settings.llmFeatures || text.trim().length < MIN_PROMPT_CHARS) return
  try {
    const labels = TIERS.map((one) => one.label)
    const answer = await $.model.classify(text, labels, { model: 'haiku' })
    const fit = TIERS.find((one) => one.label === answer)
    if (fit === undefined) return
    const [current, now] = await Promise.all([$.session.model(), $.clock.now()])
    const entry: Recommendation = { tier: fit.tier, model: fit.model, current, at: now }
    await update($, recommendations, (list) => [entry, ...list].slice(0, KEPT))
    if (settings.recommendationAlerts) await notify($, fit, current, now)
  } catch {
    // Advice is optional: a failed classification changes nothing.
  }
}
