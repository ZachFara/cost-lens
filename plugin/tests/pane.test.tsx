import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'cost-lens',
  component: 'Pane',
  requestId: 'cost-lens',
  props: {
    title: 'cost-lens',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const LABELS = [
  'Now',
  'Model',
  'Today',
  '30 days',
  'All time',
  'Projects',
  'Branches',
  'PRs',
  'Tips',
]

test('/cost-lens registers and opens the cost-lens pane', async ($, on) => {
  const registered: string[] = []
  const opened: string[] = []
  on('command.register', (_, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', (_, e) => {
    opened.push(`${e.id} ${String(e.title)} ${String(e.backgroundColor)}`)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const result = await $.command.run({
    command: 'cost-lens',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })

  expect(registered).toEqual(['cost-lens'])
  expect(opened).toEqual(['cost-lens cost-lens transparent'])
  expect(result.text).toBe('cost-lens pane opened.')
})

test('in the regular layout, /cost-lens says how to get the side panel', async ($, on) => {
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const result = await $.command.run({
    command: 'cost-lens',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 160 },
  })

  expect(result.text).toBe(
    'cost-lens pane opened above the prompt. Run /tui fullscreen to dock it beside the chat.',
  )
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the tab row shows every tab and pressing one selects it (${surface})`, async ($) => {
    const ui = await $.ui.mount({ ...PANE, surface })

    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.map((button) => button.props.label)).toEqual(LABELS)
    expect(buttons.map((button) => button.props.hotkey)).toEqual(
      LABELS.map((_, index) => String(index + 1)),
    )
    expect((await ui.find({ key: 'now' }))?.props.variant).toBe('primary')

    await ui.press({ key: 'today' })

    expect((await ui.find({ key: 'today' }))?.props.variant).toBe('primary')
    expect((await ui.find({ key: 'now' }))?.props.variant).toBe('secondary')
    await ui.unmount()
  })
}
