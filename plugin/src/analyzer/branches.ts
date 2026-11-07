import { realpathSync } from 'node:fs'

import type { UsageRecord } from '../core/cost.ts'
import { totalCost } from '../core/cost.ts'
import { withTilde } from '../core/paths.ts'
import { addSpend, emptySpend } from '../core/spend.ts'
import type { Spend } from '../core/spend.ts'
import type { CurrentProject } from '../core/summary.ts'

const BRANCHES_SHOWN = 30

/** All-time spend by git branch for one project folder and the folders inside it. */
export interface BranchTracker {
  /** The project's real path (links resolved), or undefined when no project was asked for. */
  root: string | undefined
  /** The path as asked for, before links were resolved. */
  asked: string | undefined
  real: Map<string, string>
  branches: Map<string, Spend>
}

/** A folder's real path, so a link (~/Development into ~/Ark) and its target match. */
function realPath(path: string, cache: Map<string, string>): string {
  let real = cache.get(path)
  if (real === undefined) {
    try {
      real = realpathSync(path)
    } catch {
      real = path
    }
    cache.set(path, real)
  }
  return real
}

export function branchTracker(project: string | undefined): BranchTracker {
  const real = new Map<string, string>()
  const root = project === undefined ? undefined : realPath(project, real)
  return { root, asked: project, real, branches: new Map() }
}

export interface BranchRequest {
  cwd: string | undefined
  branch: string | undefined
  record: UsageRecord
  timestamp: string | undefined
}

/** Adds a request made in the project (or a folder inside it) to its branch. */
export function trackBranch(tracker: BranchTracker, request: BranchRequest): void {
  const { root } = tracker
  if (root === undefined || request.cwd === undefined) return
  const folder = realPath(request.cwd, tracker.real)
  if (folder !== root && !folder.startsWith(`${root}/`)) return
  const branch = request.branch ?? ''
  let spend = tracker.branches.get(branch)
  if (spend === undefined) {
    spend = emptySpend()
    tracker.branches.set(branch, spend)
  }
  addSpend(spend, request.record, request.timestamp)
}

export function currentProject(tracker: BranchTracker, home: string): CurrentProject | null {
  if (tracker.asked === undefined) return null
  const branches = [...tracker.branches.entries()]
    .sort(([, a], [, b]) => totalCost(b.cost) - totalCost(a.cost) || b.requests - a.requests)
    .slice(0, BRANCHES_SHOWN)
    .map(([branch, spend]) => ({ branch, spend }))
  return { path: withTilde(tracker.asked, home), branches }
}
