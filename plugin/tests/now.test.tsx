import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

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

// Noon, local time: an hour either side stays on the same day, wherever the tests run.
const NOW = new Date(2026, 10, 7, 12, 0).getTime()
const inAnHour = new Date(NOW + 60 * 60 * 1000).toISOString()

function category(name: string, tokens: number, kind: 'used' | 'free', color: string) {
  return { name, tokens, color, isDeferred: false, kind }
}

function square(categoryName: string, color: string, isFilled: boolean, squareFullness = 1) {
  return { color, isFilled, categoryName, tokens: 0, percentage: 0, squareFullness }
}

const USAGE = {
  startedAt: 0,
  context: {
    tokens: 84_000,
    window: 1_000_000,
    percent: 8,
    breakdown: {
      categories: [
        category('Messages', 60_000, 'used', 'claude'),
        category('System tools', 20_000, 'used', 'inactive'),
        category('Free space', 900_000, 'free', 'promptBorder'),
      ],
      totalTokens: 84_000,
      maxTokens: 1_000_000,
      rawMaxTokens: 1_000_000,
      autocompactSource: 'model-default' as const,
      percentage: 8,
      gridRows: [
        [
          square('System tools', 'inactive', true),
          square('Messages', 'claude', true),
          square('Messages', 'claude', true, 0.4),
        ],
        [square('Free space', 'promptBorder', false), square('Free space', 'promptBorder', false)],
      ],
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
  mock.clock(on, { now: NOW })
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
  expect(await ui.find({ type: 'Text', text: 'Context window · 84.0k of 1.0M' })).toBeDefined()
  const squares = await ui.findAll({ type: 'Text', text: /^[■□·] $/ })
  expect(squares.map((one) => [one.text, one.props.color ?? 'dim'])).toEqual([
    ['■ ', 'inactive'],
    ['■ ', 'claude'],
    ['□ ', 'claude'],
    ['· ', 'dim'],
    ['· ', 'dim'],
  ])
  const legend = await ui.findAll({ type: 'Text', text: /^(Messages|System tools|Free space)$/ })
  expect(legend.map((one) => one.text)).toEqual(['Messages', 'System tools', 'Free space'])
  expect(await ui.find({ type: 'Text', text: '60.0k (6%)' })).toBeDefined()
  await ui.unmount()
})

test('Now says so when the engine cannot report the session', async ($) => {
  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /not available/ })).toBeDefined()
  await ui.unmount()
})

for (const [bodyColumns, asked] of [
  [50, 80],
  [120, 120],
  [30, 30],
] as const) {
  test(`a ${String(bodyColumns)}-column pane asks for a ${String(asked)}-column context grid`, async ($, on) => {
    const widths: (number | undefined)[] = []
    on('session.usage', (_, e) => {
      widths.push(e.columns)
      return { value: USAGE }
    })
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns } })

    expect(widths).toEqual([asked])
    await ui.unmount()
  })
}

const HOUR = 60 * 60 * 1000
const anHourAgo = new Date(NOW - HOUR).toISOString()

interface Window {
  kind: string
  percentUsed: number
  resetsAt?: string
}

function usageWith(rateLimits: Window[]) {
  return { ...USAGE, rateLimits }
}

/** The plan rows the tab draws, as label and percent pairs. */
async function planRows(ui: Awaited<ReturnType<typeof mountNow>>) {
  const labels = await ui.findAll({ type: 'Text', text: /^Current (session|week)/ })
  const percents = await ui.findAll({ type: 'Text', text: /^[\d.]+% used$/ })
  return labels.map((label, index) => [label.text, percents[index]?.text])
}

async function mountNow($: Engine, bodyColumns = 50) {
  return $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns } })
}

test('a plan window past its reset shows an empty bar, without a reset time', async ($, on) => {
  on('session.usage', () => ({
    value: usageWith([
      { kind: 'five_hour', percentUsed: 97, resetsAt: anHourAgo },
      { kind: 'seven_day', percentUsed: 38, resetsAt: inAnHour },
    ]),
  }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  mock.clock(on, { now: NOW })
  const ui = await mountNow($)

  expect(await planRows(ui)).toEqual([
    ['Current session', '0% used'],
    ['Current week (all models)', '38% used'],
  ])
  expect((await ui.findAll({ type: 'Text', text: /^Resets / })).length).toBe(1)
  await ui.unmount()
})

test('the session window shows empty when the engine stops reporting it', async ($, on) => {
  on('session.usage', () => ({ value: usageWith([{ kind: 'seven_day', percentUsed: 38 }]) }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  mock.clock(on, { now: NOW })
  const ui = await mountNow($)

  expect(await planRows(ui)).toEqual([
    ['Current session', '0% used'],
    ['Current week (all models)', '38% used'],
  ])
  await ui.unmount()
})

test('a gateway spend limit alone adds no plan windows', async ($, on) => {
  on('session.usage', () => ({ value: usageWith([{ kind: 'spend_limit', percentUsed: 12 }]) }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  mock.clock(on, { now: NOW })
  const ui = await mountNow($)

  expect(await planRows(ui)).toEqual([])
  expect(await ui.find({ type: 'Text', text: 'Spend limit' })).toBeDefined()
  await ui.unmount()
})

test('a per-model week past its reset shows empty', async ($, on) => {
  on('session.usage', () => ({
    value: usageWith([
      { kind: 'five_hour', percentUsed: 10, resetsAt: inAnHour },
      { kind: 'seven_day', percentUsed: 20 },
      { kind: 'seven_day_fable', percentUsed: 60, resetsAt: anHourAgo },
    ]),
  }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  mock.clock(on, { now: NOW })
  const ui = await mountNow($)

  expect(await planRows(ui)).toEqual([
    ['Current session', '10% used'],
    ['Current week (all models)', '20% used'],
    ['Current week (Fable)', '0% used'],
  ])
  await ui.unmount()
})

test('an open Now tab empties a window once its reset time passes', async ($, on) => {
  const clock = mock.clock(on)
  const resetsAt = new Date(clock.now() + 90 * 1000).toISOString()
  on('session.usage', () => ({
    value: usageWith([
      { kind: 'five_hour', percentUsed: 14, resetsAt },
      { kind: 'seven_day', percentUsed: 25 },
    ]),
  }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await mountNow($)
  expect((await planRows(ui))[0]).toEqual(['Current session', '14% used'])

  await clock.advance(2 * 60 * 1000)

  expect((await planRows(ui))[0]).toEqual(['Current session', '0% used'])
  await ui.unmount()
})

for (const [label, resetsAt, expected] of [
  ['stays at its last reading', inAnHour, '60% used'],
  ['shows empty once it resets', anHourAgo, '0% used'],
] as const) {
  test(`a per-model week the engine stops reporting ${label}`, async ($, on) => {
    const reported = [
      [
        { kind: 'five_hour', percentUsed: 10, resetsAt: inAnHour },
        { kind: 'seven_day', percentUsed: 20, resetsAt: inAnHour },
        { kind: 'seven_day_fable', percentUsed: 60, resetsAt },
      ],
      [
        { kind: 'five_hour', percentUsed: 11, resetsAt: inAnHour },
        { kind: 'seven_day', percentUsed: 21, resetsAt: inAnHour },
      ],
    ]
    on('session.measure', (_, e) => ({ changed: e.changed }))
    on('session.usage', () => ({ value: usageWith(reported[1] ?? []) }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    mock.clock(on, { now: NOW })
    for (const rateLimits of reported) {
      await $.session.measure({ context: USAGE.context, rateLimits, changed: ['rateLimits'] })
    }
    const ui = await mountNow($)

    expect(await planRows(ui)).toEqual([
      ['Current session', '11% used'],
      ['Current week (all models)', '21% used'],
      ['Current week (Fable)', expected],
    ])
    await ui.unmount()
  })
}
