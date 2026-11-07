import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'cost-lens',
  component: 'Pane',
  requestId: 'cost-lens',
  surface: 'terminal',
  props: {
    title: 'cost-lens',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

function totals(requests: number, output: number) {
  return {
    requests,
    unpricedRequests: 0,
    unpricedModels: [],
    tokens: { input: 10, output: 20, cacheWrite5m: 0, cacheWrite1h: 30, cacheRead: 960 },
    cost: { input: 0, output, cacheWrite: 35, cacheRead: 40 },
  }
}

const SUMMARY = {
  generatedAt: '2026-11-07T12:00:00.000Z',
  pricesFetched: '2026-11-07',
  today: totals(0, 0),
  last30: totals(12, 5),
  allTime: totals(1234, 25),
  byModel: {
    today: [],
    last30: [model('claude-sonnet-5-5', 12, 5, true)],
    allTime: [model('claude-fable-5-1', 1000, 25, true), model('mystery-model', 234, 0, false)],
  },
  projects: [
    {
      path: '~/code/shop',
      last30: {
        requests: 9,
        cost: { input: 0, output: 50, cacheWrite: 0, cacheRead: 0 },
        lastActive: '2026-11-07T11:42:00.000Z',
      },
    },
    {
      path: '~',
      last30: {
        requests: 3,
        cost: { input: 0, output: 5, cacheWrite: 0, cacheRead: 0 },
        lastActive: '2026-11-01T09:00:00.000Z',
      },
    },
  ],
}

function model(name: string, requests: number, output: number, isPriced: boolean) {
  const { tokens, cost } = totals(requests, output)
  return {
    model: name,
    requests,
    isPriced,
    tokens,
    cost: isPriced ? cost : { ...cost, cacheWrite: 0, cacheRead: 0 },
  }
}

function ran(stdout: string, exitCode = 0, stderr = '') {
  return {
    value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
  }
}

test('All time reads the logs and shows the total, split and hit rate', async ($, on) => {
  const commands: string[][] = []
  on('process.run', (_, e) => {
    commands.push([...e.argv])
    return ran(JSON.stringify(SUMMARY))
  })
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'all' })

  expect(commands).toHaveLength(1)
  expect(commands[0]?.slice(0, 4)).toEqual(['nice', '-n', '10', 'node'])
  expect(commands[0]?.[4]).toMatch(/src\/analyzer\/cli\.ts$/)
  expect((await ui.find({ type: 'Text', text: '$100.00' }))?.text).toBe('$100.00')
  expect((await ui.find({ type: 'Text', text: /1,234 requests/ }))?.text).toBe(
    '1,234 requests · cache hit rate 96%',
  )
  expect((await ui.find({ type: 'Text', text: /^Cache writes/ }))?.text).toBe(
    'Cache writes: $35.00 (35%)',
  )

  const swatches = await ui.findAll({ type: 'Text', text: '■' })
  const colors = swatches.map((swatch) => swatch.props.color)
  expect(colors).toEqual(['suggestion', 'warning', 'error', 'success'])

  await ui.press({ key: 'now' })
  await ui.press({ key: 'all' })
  expect(commands).toHaveLength(1)
  await ui.unmount()
})

test('a failed read says why and offers to try again', async ($, on) => {
  let calls = 0
  on('process.run', () => {
    calls += 1
    return calls === 1 ? ran('', 1, 'boom: no logs\nstack') : ran(JSON.stringify(SUMMARY))
  })
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'all' })
  expect((await ui.find({ type: 'Text', text: /Could not read/ }))?.text).toBe(
    'Could not read the logs: boom: no logs',
  )

  await ui.press({ key: 'load' })
  expect((await ui.find({ type: 'Text', text: '$100.00' }))?.text).toBe('$100.00')
  await ui.unmount()
})

test('output that is not a summary is reported, not drawn', async ($, on) => {
  on('process.run', () => ran('{"allTime": "nope"}'))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'all' })

  expect((await ui.find({ type: 'Text', text: /Could not read/ }))?.text).toBe(
    'Could not read the logs: the analyzer printed something unexpected',
  )
  await ui.unmount()
})

test('Today and 30 days show their own period, and an empty day says so', async ($, on) => {
  let runs = 0
  on('process.run', () => {
    runs += 1
    return ran(JSON.stringify(SUMMARY))
  })
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'today' })
  expect((await ui.find({ type: 'Text', text: /No Claude Code use/ }))?.text).toBe(
    'No Claude Code use today yet.',
  )

  await ui.press({ key: 'last30' })
  expect(await ui.find({ type: 'Text', text: '$80.00' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /12 requests/ }))?.text).toBe(
    '12 requests · cache hit rate 96%',
  )
  expect(runs).toBe(1)
  await ui.unmount()
})

test('each period lists its models by cost, and labels models with no published price', async ($, on) => {
  on('process.run', () => ran(JSON.stringify(SUMMARY)))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'all' })

  expect((await ui.find({ type: 'Text', text: 'By model' }))?.text).toBe('By model')
  expect(await ui.find({ type: 'Text', text: 'claude-fable-5-1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^1,000 requests/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: 'no published price' }))?.props.color).toBe('warning')

  await ui.press({ key: 'last30' })
  expect(await ui.find({ type: 'Text', text: 'claude-sonnet-5-5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'claude-fable-5-1' })).toBeUndefined()
  await ui.unmount()
})

test('Projects lists the last 30 days by project, most expensive first', async ($, on) => {
  on('process.run', () => ran(JSON.stringify(SUMMARY)))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'projects' })

  expect(await ui.find({ type: 'Text', text: 'Last 30 days, by project' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'shop' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '$50.00' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^~\/code · 9 requests/ }))?.text).toMatch(
    /^~\/code · 9 requests · last active today \d\d:\d\d$/,
  )
  expect((await ui.find({ type: 'Text', text: /^3 requests/ }))?.text).toBe(
    '3 requests · last active Nov 1',
  )
  await ui.unmount()
})
