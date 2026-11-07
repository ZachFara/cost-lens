import assert from 'node:assert/strict'
import { test } from 'node:test'

import { costPullRequests, parsePullRequests } from '../../plugin/src/core/pull-requests.ts'

const spend = (output: number) => ({
  requests: 3,
  cost: { input: 0, output, cacheWrite: 0, cacheRead: 0 },
  lastActive: '',
})

await test('gh pr list output is read; anything else is rejected', () => {
  const text = JSON.stringify([
    { number: 7, title: 'Add checkout', state: 'OPEN', headRefName: 'feat/checkout', url: 'x' },
  ])
  assert.deepEqual(parsePullRequests(text), [
    { number: 7, title: 'Add checkout', state: 'OPEN', branch: 'feat/checkout' },
  ])
  assert.equal(parsePullRequests('[{"number": "7"}]'), undefined)
  assert.equal(parsePullRequests('{}'), undefined)
  assert.equal(parsePullRequests('nope'), undefined)
})

await test('each PR gets its head branch cost; costliest first, unused branches last by number', () => {
  const prs = [
    { number: 1, title: 'a', state: 'MERGED', branch: 'feat/a' },
    { number: 2, title: 'b', state: 'OPEN', branch: 'feat/b' },
    { number: 3, title: 'c', state: 'CLOSED', branch: 'feat/c' },
    { number: 4, title: 'd', state: 'OPEN', branch: 'feat/d' },
  ]
  const branches = [
    { branch: 'feat/a', spend: spend(5) },
    { branch: 'feat/b', spend: spend(9) },
  ]
  assert.deepEqual(
    costPullRequests(prs, branches).map((one) => [one.number, one.spend?.cost.output]),
    [
      [2, 9],
      [1, 5],
      [4, undefined],
      [3, undefined],
    ],
  )
})
