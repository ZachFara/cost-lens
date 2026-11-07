import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { branchTracker, currentProject, trackBranch } from '../../src/analyzer/branches.ts'
import type { UsageRecord } from '../../src/core/cost.ts'

const MILLION_OUT: UsageRecord = {
  model: 'claude-sonnet-5-5',
  usage: { input: 0, output: 1_000_000, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
}

await test('branches count work in the project and its folders, through links too', () => {
  const base = mkdtempSync(join(tmpdir(), 'cost-lens-branches-'))
  try {
    const repo = join(base, 'real', 'shop')
    mkdirSync(join(repo, 'web'), { recursive: true })
    symlinkSync(join(base, 'real'), join(base, 'link'))
    const tracker = branchTracker(join(base, 'link', 'shop'))
    const request = (cwd: string, branch: string | undefined, timestamp: string) => {
      trackBranch(tracker, { cwd, branch, record: MILLION_OUT, timestamp })
    }
    request(repo, 'main', '2026-11-01T10:00:00.000Z')
    request(join(base, 'link', 'shop', 'web'), 'main', '2026-11-03T10:00:00.000Z')
    request(repo, 'feat/x', '2026-11-02T10:00:00.000Z')
    request(join(base, 'real', 'shopping'), 'main', '2026-11-04T10:00:00.000Z')
    request(repo, undefined, '2026-11-05T10:00:00.000Z')

    const project = currentProject(tracker, base)
    assert.equal(project?.path, '~/link/shop')
    assert.deepEqual(
      project.branches.map(({ branch, spend }) => [branch, spend.requests, spend.cost.output]),
      [
        ['main', 2, 20],
        ['feat/x', 1, 10],
        ['', 1, 10],
      ],
    )
    assert.equal(project.branches[0]?.spend.lastActive, '2026-11-03T10:00:00.000Z')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

await test('without a project there is no current project', () => {
  assert.equal(currentProject(branchTracker(undefined), '/home/me'), null)
})
