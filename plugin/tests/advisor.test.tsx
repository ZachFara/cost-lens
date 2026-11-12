import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 7, 12, 0)
const ROUTINE = 'routine: everyday coding, a bug fix, tests or a small feature'
const COMPLEX = 'complex: careful reasoning, debugging across files, or design'
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

const LLM_ON = { options: { llmFeatures: true } }

function typed(text: string) {
  return { text, wait: false, origin: { kind: 'composer' } } as const
}

test(
  'a routine prompt on Opus suggests Sonnet, and the prompt goes out as typed',
  LLM_ON,
  async ($, on) => {
    const { toasts } = harness(on, 'claude-opus-5-5', () => ROUTINE)

    const result = await $.prompt.submit(typed(LONG))

    expect(result).toEqual({ text: LONG })
    expect(toasts).toEqual([
      'cost-lens: this looks routine (everyday coding, a bug fix, tests or a small feature). ' +
        'Sonnet 5.5 fits, at 2x less per token. /model sonnet',
    ])
  },
)

test('a complex prompt on Sonnet suggests Opus', LLM_ON, async ($, on) => {
  const { toasts } = harness(on, 'claude-sonnet-5-5', () => COMPLEX)

  await $.prompt.submit(typed(LONG))

  expect(toasts).toEqual([
    'cost-lens: this looks complex (careful reasoning, debugging across files, or design). ' +
      'Opus 5.5 may do it better, at 2x the price per token. /model opus',
  ])
})

test('no toast when the current model already fits', LLM_ON, async ($, on) => {
  const { toasts, classified } = harness(on, 'claude-sonnet-5-5', () => ROUTINE)

  await $.prompt.submit(typed(LONG))

  expect(classified).toHaveLength(1)
  expect(toasts).toEqual([])
})

test('one suggestion per ten minutes', LLM_ON, async ($, on) => {
  const { toasts, clock } = harness(on, 'claude-fable-5-1', () => ROUTINE)

  await $.prompt.submit(typed(LONG))
  await clock.advance(5 * 60 * 1000)
  await $.prompt.submit(typed(LONG))
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('Sonnet 5.5 fits, at 5x less per token.')

  await clock.advance(6 * 60 * 1000)
  await $.prompt.submit(typed(LONG))
  expect(toasts).toHaveLength(2)
})

test(
  'a short follow-up is not judged, and a failed classification changes nothing',
  LLM_ON,
  async ($, on) => {
    let calls = 0
    const { toasts, classified } = harness(on, 'claude-opus-5-5', () => {
      calls += 1
      throw new Error('rate limited')
    })

    await $.prompt.submit(typed('continue'))
    expect(classified).toHaveLength(0)

    const result = await $.prompt.submit(typed(LONG))
    expect(calls).toBe(1)
    expect(result).toEqual({ text: LONG })
    expect(toasts).toEqual([])
  },
)

test('with LLM features off (the default) nothing is sent to a model', async ($, on) => {
  const { toasts, classified } = harness(on, 'claude-opus-5-5', () => ROUTINE)

  const result = await $.prompt.submit(typed(LONG))

  expect(result).toEqual({ text: LONG })
  expect(classified).toEqual([])
  expect(toasts).toEqual([])
})

test(
  'with notifications off the prompt is judged but no toast shows',
  { options: { llmFeatures: true, recommendationAlerts: false } },
  async ($, on) => {
    const { toasts, classified } = harness(on, 'claude-opus-5-5', () => ROUTINE)

    await $.prompt.submit(typed(LONG))

    expect(classified).toHaveLength(1)
    expect(toasts).toEqual([])
  },
)

const HARDEST = 'hardest: long multi-step work, research, or an ambitious change'

test('a hard prompt on Opus suggests the newest Fable', LLM_ON, async ($, on) => {
  const { toasts } = harness(on, 'claude-opus-5-5', () => HARDEST)

  await $.prompt.submit(typed(LONG))

  expect(toasts).toEqual([
    'cost-lens: this looks hardest (long multi-step work, research, or an ambitious change). ' +
      'Fable 5.2 may do it better, at 2x the price per token. /model fable',
  ])
})

test(
  'once the analyzer has read the pricing page, its newest model is the one suggested',
  LLM_ON,
  async ($, on) => {
    const { toasts } = harness(on, 'claude-opus-5-5', () => HARDEST)
    on('state.get', { key: 'history' }, () => ({
      value: {
        value: {
          shape: 'history-10',
          value: {
            status: 'ready',
            isRefreshing: false,
            refreshError: null,
            summary: { models: ['claude-fable-5-2', 'claude-fable-5-3'], prices: [] },
          },
        },
        version: 1,
      },
    }))

    await $.prompt.submit(typed(LONG))

    expect(toasts).toEqual([
      'cost-lens: this looks hardest (long multi-step work, research, or an ambitious change). ' +
        'Fable 5.3 may do it better. /model fable',
    ])
  },
)
