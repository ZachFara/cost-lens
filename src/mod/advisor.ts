import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { TIERS, familyOf, priceComparison } from '../core/models.ts'
import type { TierModel } from '../core/models.ts'
import type { Recommendation } from '../../types'

// Change a tag when its value's fields change: it declines what an earlier version stored.
const recommendation = atom({ plugin: 'cost-lens', key: 'recommendation' } as const, null, {
  shape: 'recommendation-1',
})
const lastAdviceAt = atom({ plugin: 'cost-lens', key: 'lastAdviceAt' } as const, 0)

const ADVICE_EVERY_MS = 10 * 60 * 1000
/** Shorter prompts ("continue", "yes") carry on earlier work; they are not judged. */
const MIN_PROMPT_CHARS = 40

/** The recommendation for the session's last judged prompt; reads stay in this file. */
export function readRecommendation($: EngineInterface): Promise<Recommendation | null> {
  return read($, recommendation)
}

function adviceText(fit: TierModel, current: string): string {
  const comparison = priceComparison(current, fit.model)
  const cheaper = comparison?.endsWith('less per token') === true
  const why = cheaper
    ? `${fit.name} fits, at ${comparison}`
    : `${fit.name} may do it better${comparison === undefined ? '' : `, at ${comparison}`}`
  return `cost-lens: this looks ${fit.tier} (${fit.label.split(': ')[1] ?? ''}). ${why}. /model ${fit.alias}`
}

/**
 * After a typed prompt has entered, the small fast model judges which tier it is; the Now
 * tab shows the fitting model, and a toast suggests it when it is not the current model's
 * family, at most once every ten minutes. Never throws.
 */
export async function adviseModel($: EngineInterface, text: string): Promise<void> {
  try {
    if (text.trim().length < MIN_PROMPT_CHARS) return
    const labels = TIERS.map((one) => one.label)
    const answer = await $.model.classify(text, labels, { model: 'haiku' })
    const fit = TIERS.find((one) => one.label === answer)
    if (fit === undefined) return
    const [current, now] = await Promise.all([$.session.model(), $.clock.now()])
    await update($, recommendation, () => ({ tier: fit.tier, model: fit.model, current, at: now }))
    if (familyOf(current) === fit.family) return
    if (now - (await read($, lastAdviceAt)) < ADVICE_EVERY_MS) return
    await update($, lastAdviceAt, () => now)
    $.ui.toast(adviceText(fit, current), { timeoutMs: 10_000 })
  } catch {
    // Advice is optional: a failed classification changes nothing.
  }
}
