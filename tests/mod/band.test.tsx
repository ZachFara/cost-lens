import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.UTC(2026, 10, 7, 12, 0)
const MINUTE = 60 * 1000

const BAND = {
  plugin: 'cost-lens',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

function lastRequest(minutesAgo: number) {
  const request = { at: NOW - minutesAgo * MINUTE, model: 'claude-opus-5-5', promptTokens: 84_000 }
  return { value: { value: { shape: 'last-request-1', value: request }, version: 1 } }
}

for (const [minutesAgo, expected] of [
  [19, 'cost-lens · cache warm · 41m left · 84.0k context'],
  [120, 'cost-lens · cache cold · next message re-writes 84.0k tokens ≈ $0.67 (warm: $0.02)'],
] as const) {
  test(`the band shows the cache ${String(minutesAgo)} minutes after the last request`, async ($, on) => {
    mock.clock(on, { now: NOW })
    on('state.get', { key: 'lastRequest' }, () => lastRequest(minutesAgo))
    const ui = await $.ui.mount(BAND)

    expect((await ui.find({ type: 'Text', text: /^cost-lens · / }))?.text).toBe(expected)
    await ui.unmount()
  })
}

test('before the first reply the band leaves the line to the engine', async ($, on) => {
  on('ui.render', ($e, e) => {
    const { Text } = $e.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /^cost-lens/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('Hide removes the band; /cost-lens band brings it back', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('state.get', { key: 'lastRequest' }, () => lastRequest(5))
  on('ui.render', ($e, e) => {
    const { Text } = $e.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(BAND)

  await ui.press({ key: 'hide-band' })
  expect(await ui.find({ type: 'Text', text: /^cost-lens/ })).toBeUndefined()

  const result = await $.command.run({
    command: 'cost-lens',
    args: 'band',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(result.text).toBe('cost-lens cache line shown.')
  expect(await ui.find({ type: 'Text', text: /^cost-lens · cache warm/ })).toBeDefined()
  await ui.unmount()
})
