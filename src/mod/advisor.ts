import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { ratesFor } from '../core/pricing.ts'

const lastAdviceAt = atom({ plugin: 'cost-lens', key: 'lastAdviceAt' } as const, 0)

const ROUTINE = 'routine: a small fix, edit, rename, lookup or question'
const LABELS = [ROUTINE, 'complex: hard reasoning, design, debugging or a large change']
const ADVICE_EVERY_MS = 10 * 60 * 1000
/** Shorter prompts ("continue", "yes") carry on earlier work; they are not judged. */
const MIN_PROMPT_CHARS = 40
const SONNET = 'claude-sonnet-5-5'
const PREMIUM = /opus|fable|mythos/i

function cheaperBy(model: string): string {
  const current = ratesFor({ model, promptTokens: 0 })?.input
  const sonnet = ratesFor({ model: SONNET, promptTokens: 0 })?.input
  if (current === undefined || sonnet === undefined) return ''
  return ` Sonnet 5.5 costs ${String(Math.round(current / sonnet))}x less per token.`
}

/**
 * After a prompt has entered on an Opus or Fable model, asks the small fast model whether
 * it is routine and, if so, suggests Sonnet; at most once every ten minutes. Never throws.
 */
export async function adviseModel($: EngineInterface, text: string): Promise<void> {
  try {
    if (text.trim().length < MIN_PROMPT_CHARS) return
    const model = await $.session.model()
    const now = await $.clock.now()
    if (!PREMIUM.test(model) || now - (await read($, lastAdviceAt)) < ADVICE_EVERY_MS) return
    if ((await $.model.classify(text, LABELS, { model: 'haiku' })) !== ROUTINE) return
    await update($, lastAdviceAt, () => now)
    $.ui.toast(
      `cost-lens: this looks like a routine task for ${model}.${cheaperBy(model)} /model sonnet`,
      {
        timeoutMs: 10_000,
      },
    )
  } catch {
    // Advice is optional: a failed classification changes nothing.
  }
}
