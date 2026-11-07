import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'cost-lens',
  component: 'Pane',
  requestId: 'cost-lens',
  surface: 'terminal',
  props: {
    title: 'cost-lens',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const empty = {
  requests: 0,
  unpricedRequests: 0,
  unpricedModels: [],
  tokens: { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
  cost: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
}

const SUMMARY = {
  generatedAt: '2026-11-07T12:00:00.000Z',
  pricesFetched: '2026-11-07',
  today: empty,
  last30: empty,
  allTime: empty,
  byModel: { today: [], last30: [], allTime: [] },
  projects: [],
  currentProject: {
    path: '~/code/shop',
    branches: [
      {
        branch: 'feat/checkout',
        spend: {
          requests: 7,
          cost: { input: 0, output: 30, cacheWrite: 0, cacheRead: 0 },
          lastActive: '',
        },
      },
    ],
  },
}

const PRS = [
  { number: 12, title: 'Add checkout', state: 'OPEN', headRefName: 'feat/checkout' },
  { number: 11, title: 'Fix typo', state: 'MERGED', headRefName: 'fix/typo' },
]

function ran(stdout: string, exitCode = 0, stderr = '') {
  return {
    value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
  }
}

const REPO = { value: { root: '/code/shop', remote: null, internal: false, name: null } }

test('PRs lists pull requests with what their branch cost', async ($, on) => {
  const ghFolders: (string | undefined)[] = []
  on('session.repo', () => REPO)
  on('process.run', (_, e) => {
    if (e.argv[0] !== 'gh') return ran(JSON.stringify(SUMMARY))
    ghFolders.push(e.init?.cwd)
    return ran(JSON.stringify(PRS))
  })
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'prs' })

  expect(ghFolders).toEqual(['/code/shop'])
  expect(await ui.find({ type: 'Text', text: '#12 Add checkout' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '$30.00' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: 'open' }))?.props.color).toBe('success')
  expect((await ui.find({ type: 'Text', text: 'merged' }))?.props.color).toBe('permission')
  expect(await ui.find({ type: 'Text', text: 'no Claude Code use' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'feat/checkout · 7 requests' })).toBeDefined()

  await ui.press({ key: 'refresh' })
  expect(ghFolders).toHaveLength(2)
  await ui.unmount()
})

test('when gh fails, the tab says why', async ($, on) => {
  on('session.repo', () => REPO)
  on('process.run', (_, e) =>
    e.argv[0] === 'gh' ? ran('', 1, 'no git remotes found\nmore') : ran(JSON.stringify(SUMMARY)),
  )
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'prs' })

  expect((await ui.find({ type: 'Text', text: /^No pull requests/ }))?.text).toBe(
    'No pull requests: no git remotes found',
  )
  await ui.unmount()
})

test('outside a git repository, the tab says so', async ($, on) => {
  on('session.repo', () => ({ value: null }))
  on('session.cwd', () => ({ value: '/tmp' }))
  on('process.run', () => ran(JSON.stringify({ ...SUMMARY, currentProject: null })))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'prs' })

  expect((await ui.find({ type: 'Text', text: /^No pull requests/ }))?.text).toBe(
    'No pull requests: this session is not in a git repository',
  )
  await ui.unmount()
})
