import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'cost-lens',
  component: 'Pane',
  requestId: 'cost-lens',
  surface: 'terminal',
  props: {
    title: 'cost-lens',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const inAnHour = new Date(Date.now() + 60 * 60 * 1000).toISOString()

function category(name: string, tokens: number, kind: 'used' | 'free') {
  return { name, tokens, color: 'text', isDeferred: false, kind }
}

const USAGE = {
  startedAt: 0,
  context: {
    tokens: 84_000,
    window: 1_000_000,
    percent: 8,
    breakdown: {
      categories: [
        category('Messages', 60_000, 'used'),
        category('System tools', 20_000, 'used'),
        category('Free space', 900_000, 'free'),
      ],
      totalTokens: 84_000,
      maxTokens: 1_000_000,
      rawMaxTokens: 1_000_000,
      autocompactSource: 'model-default' as const,
      percentage: 8,
      gridRows: [],
      model: 'claude-opus-5-5',
      memoryFiles: [],
      mcpTools: [],
      agents: [],
      isAutoCompactEnabled: true,
      apiUsage: null,
    },
  },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 14, resetsAt: inAnHour },
    { kind: 'seven_day', percentUsed: 25 },
    { kind: 'seven_day_fable', percentUsed: 85.5 },
  ],
  cost: { usd: 3.06 },
}

test('Now shows plan usage, this session and what fills the context', async ($, on) => {
  on('session.usage', () => ({ value: USAGE }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: 'Current session' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '14% used' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^Resets / }))?.text).toMatch(/^Resets \d\d:\d\d$/)
  expect(await ui.find({ type: 'Text', text: 'Current week (all models)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Current week (Fable)' })).toBeDefined()
  const bars = await ui.findAll({ type: 'Text', text: /^█+$/ })
  expect(bars.map((bar) => bar.props.color)).toEqual(['success', 'success', 'error'])

  expect(await ui.find({ type: 'Text', text: 'claude-opus-5-5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '$3.06' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^Context / }))?.text).toBe(
    'Context 84.0k of 1.0M (8%) · 0 requests',
  )
  expect(await ui.find({ type: 'Text', text: 'Messages' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '60.0k' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Free space' })).toBeUndefined()
  await ui.unmount()
})

test('Now says so when the engine cannot report the session', async ($) => {
  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /not available/ })).toBeDefined()
  await ui.unmount()
})
