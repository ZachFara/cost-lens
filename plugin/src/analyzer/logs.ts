import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { addRecord, addToModel, emptyTotals, rankModels } from '../core/cost.ts'
import { totalCost } from '../core/cost.ts'
import type { ModelTotals, Totals, UsageRecord } from '../core/cost.ts'
import { daysBefore, localDay } from '../core/days.ts'

import { branchTracker, currentProject, trackBranch } from './branches.ts'
import type { BranchTracker } from './branches.ts'
import {
  addTipsRequest,
  fileState,
  latestCacheLifetimeMs,
  noteUses,
  tipsSummary,
  tipsTracker,
} from './tips.ts'
import type { FileState, TipsTracker } from './tips.ts'
import { offeredModels, pricesFetched } from '../core/pricing.ts'
import { withTilde } from '../core/paths.ts'
import { addSpend, emptySpend } from '../core/spend.ts'
import type { Spend } from '../core/spend.ts'
import type { Period, ProjectSpend, Summary } from '../core/summary.ts'

type Json = Record<string, unknown>

function asObject(value: unknown): Json | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined
}

/** A token count from the log: a finite, non-negative number, anything else counts as 0. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function usageRecord(model: string, usage: Json): UsageRecord {
  const written = count(usage.cache_creation_input_tokens)
  const split = asObject(usage.cache_creation)
  const write1h = split ? count(split.ephemeral_1h_input_tokens) : 0
  return {
    model,
    usage: {
      input: count(usage.input_tokens),
      output: count(usage.output_tokens),
      cacheWrite5m: split ? count(split.ephemeral_5m_input_tokens) : written,
      cacheWrite1h: write1h,
      cacheRead: count(usage.cache_read_input_tokens),
    },
    speed: text(usage.speed),
    geo: text(usage.inference_geo),
  }
}

/**
 * One session-log line to a usage record keyed by the API message id. Lines are
 * untrusted data: anything that is not an assistant message with usage is skipped.
 */
export function recordFromLine(line: string): Found | undefined {
  const entry = assistantEntry(line)
  if (entry === undefined) return undefined
  const message = asObject(entry.message)
  const usage = asObject(message?.usage)
  const id = text(message?.id)
  const model = text(message?.model)
  if (!usage || !id || !model || model === '<synthetic>') return undefined
  const record = usageRecord(model, usage)
  return {
    id,
    record,
    timestamp: text(entry.timestamp),
    cwd: text(entry.cwd),
    branch: text(entry.gitBranch),
    uses: usesOf(message),
    isSidechain: entry.isSidechain === true,
  }
}

/** A tool call as a tip counts it: `skill:<name>` or `mcp:<server>`; other tools are not. */
function useOf(block: Json): string | undefined {
  const name = text(block.name)
  if (name === 'Skill') {
    const skill = text(asObject(block.input)?.skill)
    return skill === undefined ? undefined : `skill:${skill}`
  }
  const server = name === undefined ? undefined : /^mcp__(.+?)__/.exec(name)?.[1]
  return server === undefined ? undefined : `mcp:${server}`
}

function usesOf(message: Json | undefined): string[] {
  const content = message?.content
  if (!Array.isArray(content)) return []
  return content.flatMap((block) => {
    const one = asObject(block)
    const use = one?.type === 'tool_use' ? useOf(one) : undefined
    return use === undefined ? [] : [use]
  })
}

interface Found {
  id: string
  record: UsageRecord
  /** When the response was logged, as the log wrote it (ISO 8601); undefined when absent. */
  timestamp: string | undefined
  /** The session's working folder; undefined when absent. */
  cwd: string | undefined
  /** The git branch checked out then; undefined outside a repository. */
  branch: string | undefined
  /** The skills and MCP servers this line's content called. */
  uses: string[]
  /** A subagent's request inside the main session's log. */
  isSidechain: boolean
}

function assistantEntry(line: string): Json | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  const entry = asObject(parsed)
  return entry?.type === 'assistant' ? entry : undefined
}

interface Bucket {
  totals: Totals
  models: Map<string, ModelTotals>
}

type Periods = Record<Period, Bucket>

interface Accumulator {
  periods: Periods
  /** Last-30-days spend by working folder. */
  projects: Map<string, Spend>
  branches: BranchTracker
  tips: TipsTracker
}

const PROJECTS_SHOWN = 15

function emptyPeriods(): Periods {
  const bucket = (): Bucket => ({ totals: emptyTotals(), models: new Map() })
  return { today: bucket(), last30: bucket(), allTime: bucket() }
}

function add(bucket: Bucket, record: UsageRecord): void {
  addRecord(bucket.totals, record)
  addToModel(bucket.models, record)
}

const LAST_DAYS = 30

/** Every request counts toward All time; dated ones also toward Today and the last 30 days. */
function addFound(into: Accumulator, found: Found, today: string, file: FileState): void {
  const { periods } = into
  add(periods.allTime, found.record)
  trackBranch(into.branches, found)
  const at = found.timestamp === undefined ? Number.NaN : Date.parse(found.timestamp)
  const age = Number.isNaN(at) ? Number.NaN : daysBefore(localDay(new Date(at)), today)
  const isRecent = age >= 0 && age < LAST_DAYS
  addTipsRequest(into.tips, file, { ...found, at, isRecent })
  if (!isRecent) return
  if (age === 0) add(periods.today, found.record)
  add(periods.last30, found.record)
  if (found.cwd !== undefined) addProject(into.projects, found.cwd, found)
}

function addProject(projects: Map<string, Spend>, cwd: string, found: Found): void {
  let spend = projects.get(cwd)
  if (spend === undefined) {
    spend = emptySpend()
    projects.set(cwd, spend)
  }
  addSpend(spend, found.record, found.timestamp)
}

function topProjects(projects: Map<string, Spend>, home: string): ProjectSpend[] {
  return [...projects.entries()]
    .sort(([, a], [, b]) => totalCost(b.cost) - totalCost(a.cost))
    .slice(0, PROJECTS_SHOWN)
    .map(([path, last30]) => ({ path: withTilde(path, home), last30 }))
}

async function logFiles(root: string): Promise<string[]> {
  try {
    const names = await readdir(root, { recursive: true })
    return names.filter((name) => name.endsWith('.jsonl')).sort()
  } catch {
    return []
  }
}

async function addFile(
  path: string,
  seen: Set<string>,
  into: Accumulator,
  today: string,
): Promise<void> {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  const file = fileState()
  for await (const line of lines) {
    if (!line.includes('"usage"')) continue
    const found = recordFromLine(line)
    if (found === undefined) continue
    noteUses(into.tips, found.id, found.uses)
    if (seen.has(found.id)) continue
    seen.add(found.id)
    addFound(into, found, today, file)
  }
}

export interface SummarizeOptions {
  /** The repository the session runs in: its branches are counted. */
  project?: string | undefined
  /** The home folder, written as ~ in paths; the user's own by default. */
  home?: string
}

/** Reads every session log under `root` (Claude Code keeps them in ~/.claude/projects). */
export async function summarize(
  root: string,
  now: Date,
  { project, home = homedir() }: SummarizeOptions = {},
): Promise<Summary> {
  const into: Accumulator = {
    periods: emptyPeriods(),
    projects: new Map(),
    branches: branchTracker(project),
    tips: tipsTracker(now),
  }
  const { periods } = into
  const today = localDay(now)
  const seen = new Set<string>()
  for (const name of await logFiles(root)) {
    await addFile(join(root, name), seen, into, today)
  }
  return {
    generatedAt: now.toISOString(),
    pricesFetched: pricesFetched(),
    models: offeredModels(),
    today: periods.today.totals,
    last30: periods.last30.totals,
    allTime: periods.allTime.totals,
    byModel: {
      today: rankModels(periods.today.models),
      last30: rankModels(periods.last30.models),
      allTime: rankModels(periods.allTime.models),
    },
    projects: topProjects(into.projects, home),
    currentProject: currentProject(into.branches, home),
    tips: tipsSummary(into.tips),
    cacheLifetimeMs: latestCacheLifetimeMs(into.tips),
  }
}
