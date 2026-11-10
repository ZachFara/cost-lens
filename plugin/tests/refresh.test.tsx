import { expect, mock, test } from 'claude-code/testing'

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

const FIVE_MINUTES = 5 * 60 * 1000

function totals(output: number) {
  return {
    requests: 1,
    unpricedRequests: 0,
    unpricedModels: [],
    tokens: { input: 1, output: 1, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
    cost: { input: 0, output, cacheWrite: 0, cacheRead: 0 },
  }
}

function summary(output: number) {
  return JSON.stringify({
    generatedAt: '2026-11-07T12:00:00.000Z',
    pricesFetched: '2026-11-07',
    models: [],
    today: totals(output),
    last30: totals(output),
    allTime: totals(output),
    byModel: { today: [], last30: [], allTime: [] },
    projects: [],
    currentProject: null,
    cacheLifetimeMs: 3_600_000,
    tips: {
      last30: { cost: 0, coldRebuilds: 0, coldWaste: 0, largeContextCost: 0 },
      last24h: { cost: 0, largeContextCost: 0, skills: [], mcpServers: [] },
    },
  })
}

function ran(stdout: string, exitCode = 0, stderr = '') {
  return {
    value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
  }
}

function pane(isShown: boolean) {
  return { id: 'cost-lens', title: 'cost-lens', isShown, isFocused: false, isPlaced: true }
}

test('Refresh re-reads the logs; a failed refresh keeps the last numbers', async ($, on) => {
  const outputs = [ran(summary(10)), ran(summary(20)), ran('', 1, 'disk gone')]
  on('process.run', () => outputs.shift() ?? ran('', 1, 'no more runs'))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'all' })
  expect(await ui.find({ type: 'Text', text: '$10.00' })).toBeDefined()

  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: '$20.00' })).toBeDefined()

  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: '$20.00' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /Last refresh failed/ }))?.text).toBe(
    'Last refresh failed: disk gone',
  )
  await ui.unmount()
})

for (const isShown of [true, false]) {
  test(`every five minutes the numbers refresh only while the pane is shown (${String(isShown)})`, async ($, on) => {
    const clock = mock.clock(on)
    let runs = 0
    on('process.run', () => {
      runs += 1
      return ran(summary(runs * 10))
    })
    on('ui.panes', () => ({ value: [pane(isShown)] }))
    on('command.register', (_, e) => ({ value: { command: e.name } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

    await clock.advance(FIVE_MINUTES)
    expect(runs).toBe(0)

    const ui = await $.ui.mount(PANE)
    await ui.press({ key: 'all' })
    await clock.advance(FIVE_MINUTES)

    expect(runs).toBe(isShown ? 2 : 1)
    expect(await ui.find({ type: 'Text', text: isShown ? '$20.00' : '$10.00' })).toBeDefined()
    await ui.unmount()
  })
}
