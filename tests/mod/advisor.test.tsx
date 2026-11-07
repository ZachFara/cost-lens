import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 7, 12, 0)
const ROUTINE = 'routine: a small fix, edit, rename, lookup or question'
const COMPLEX = 'complex: hard reasoning, design, debugging or a large change'
const LONG = 'rename the getUser function to fetchUser everywhere in src please'

function harness(on: On, model: string, answer: () => string) {
  const toasts: string[] = []
  const classified: string[] = []
  const clock = mock.clock(on, { now: NOW })
  on('session.model', () => ({ value: model }))
  on('model.classify', (_, e) => {
    classified.push(e.text)
    return { value: answer() }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  return { toasts, classified, clock }
}

function typed(text: string) {
  return { text, wait: false, origin: { kind: 'composer' } } as const
}

test('a routine prompt on Opus gets one Sonnet suggestion, and the prompt goes out as typed', async ($, on) => {
  const { toasts } = harness(on, 'claude-opus-5-5', () => ROUTINE)

  const result = await $.prompt.submit(typed(LONG))

  expect(result).toEqual({ text: LONG })
  expect(toasts).toEqual([
    'cost-lens: this looks like a routine task for claude-opus-5-5. Sonnet 5.5 costs 2x less per token. /model sonnet',
  ])
})

test('one suggestion per ten minutes', async ($, on) => {
  const { toasts, clock } = harness(on, 'claude-fable-5-1', () => ROUTINE)

  await $.prompt.submit(typed(LONG))
  await clock.advance(5 * 60 * 1000)
  await $.prompt.submit(typed(LONG))
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('Sonnet 5.5 costs 5x less per token.')

  await clock.advance(6 * 60 * 1000)
  await $.prompt.submit(typed(LONG))
  expect(toasts).toHaveLength(2)
})

for (const [label, model, text, answer, judged] of [
  ['a complex prompt', 'claude-opus-5-5', LONG, COMPLEX, true],
  ['a Sonnet session', 'claude-sonnet-5-5', LONG, ROUTINE, false],
  ['a short follow-up', 'claude-opus-5-5', 'continue', ROUTINE, false],
] as const) {
  test(`no suggestion for ${label}`, async ($, on) => {
    const { toasts, classified } = harness(on, model, () => answer)

    await $.prompt.submit(typed(text))

    expect(toasts).toEqual([])
    expect(classified).toHaveLength(judged ? 1 : 0)
  })
}

test('a failed classification changes nothing', async ($, on) => {
  const { toasts } = harness(on, 'claude-opus-5-5', () => {
    throw new Error('rate limited')
  })

  const result = await $.prompt.submit(typed(LONG))

  expect(result).toEqual({ text: LONG })
  expect(toasts).toEqual([])
})
