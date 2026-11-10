import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'cost-lens',
  component: 'Pane',
  requestId: 'cost-lens',
  surface: 'terminal',
  props: {
    title: 'cost-lens',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const AT = new Date(2026, 10, 7, 12, 41).getTime()

function recent(...models: string[]) {
  const value = models.map((model, index) => ({
    tier: model.includes('sonnet') ? 'routine' : 'complex',
    model,
    current: 'claude-opus-5-5',
    at: AT - index * 60_000,
  }))
  return { value: { value: { shape: 'recommendations-1', value }, version: 1 } }
}

test('with LLM features off the Model tab says what turning them on sends', async ($) => {
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'model' })

  expect(await ui.find({ type: 'Text', text: 'Model recommendations are off' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /reads the text of each prompt/ }))?.text).toContain(
    'Turn on "Allow LLM features" in /config',
  )
  expect(await ui.find({ type: 'Text', text: 'How prompts are judged' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Fable 5.2' })).toBeDefined()
  expect(
    await ui.find({
      type: 'Text',
      text: 'LLM features: off · notifications: on · change in /config',
    }),
  ).toBeDefined()
  await ui.unmount()
})

test(
  'the Model tab shows the latest recommendation and recent ones',
  { options: { llmFeatures: true } },
  async ($, on) => {
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('state.get', { key: 'recommendations' }, () =>
      recent('claude-sonnet-5-5', 'claude-opus-5-5'),
    )
    const ui = await $.ui.mount(PANE)

    await ui.press({ key: 'model' })

    expect(await ui.find({ type: 'Text', text: 'Last prompt looks routine' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: 'Sonnet 5.5 fits' }))?.props.color).toBe('warning')
    expect(
      await ui.find({
        type: 'Text',
        text: "You're on claude-opus-5-5 · 2x less per token · /model sonnet",
      }),
    ).toBeDefined()
    expect(
      await ui.find({ type: 'Text', text: '12:41  routine → Sonnet 5.5 (on claude-opus-5-5)' }),
    ).toBeDefined()
    expect(
      await ui.find({ type: 'Text', text: '12:40  complex → Opus 5.5 (on claude-opus-5-5)' }),
    ).toBeDefined()
    await ui.unmount()
  },
)

test(
  'before any judged prompt the Model tab says what to do',
  { options: { llmFeatures: true } },
  async ($, on) => {
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    const ui = await $.ui.mount(PANE)

    await ui.press({ key: 'model' })

    expect(await ui.find({ type: 'Text', text: /^Send a prompt of 40 characters/ })).toBeDefined()
    await ui.unmount()
  },
)
