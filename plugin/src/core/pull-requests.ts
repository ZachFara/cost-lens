import { totalCost } from './cost.ts'
import type { Spend } from './spend.ts'

/** The arguments of `gh` that list a repository's pull requests, as the PRs tab reads them. */
export const PR_LIST_ARGS: readonly string[] = [
  'pr',
  'list',
  '--state',
  'all',
  '--limit',
  '100',
  '--json',
  'number,title,state,headRefName',
]

export interface PullRequest {
  number: number
  title: string
  /** As GitHub reports it: OPEN, MERGED or CLOSED. */
  state: string
  /** The PR's head branch. */
  branch: string
}

export interface PullRequestCost extends PullRequest {
  /** What Claude Code work on the head branch cost; undefined when none was recorded. */
  spend: Spend | undefined
}

function isPullRequestJson(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const one = value as Record<string, unknown>
  return (
    typeof one.number === 'number' &&
    typeof one.title === 'string' &&
    typeof one.state === 'string' &&
    typeof one.headRefName === 'string'
  )
}

/** Reads `gh pr list --json number,title,state,headRefName`; anything else is rejected. */
export function parsePullRequests(text: string): PullRequest[] | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!Array.isArray(value) || !value.every(isPullRequestJson)) return undefined
  return value.map((one) => ({
    number: one.number as number,
    title: one.title as string,
    state: one.state as string,
    branch: one.headRefName as string,
  }))
}

/** Each PR with what its head branch cost; most expensive first, then newest. */
export function costPullRequests(
  pullRequests: readonly PullRequest[],
  branches: readonly { branch: string; spend: Spend }[],
): PullRequestCost[] {
  const byBranch = new Map(branches.map(({ branch, spend }) => [branch, spend]))
  const cost = (one: PullRequestCost) => (one.spend ? totalCost(one.spend.cost) : -1)
  return pullRequests
    .map((one) => ({ ...one, spend: byBranch.get(one.branch) }))
    .sort((a, b) => cost(b) - cost(a) || b.number - a.number)
}
