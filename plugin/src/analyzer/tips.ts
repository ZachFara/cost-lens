import { costOf, totalCost } from '../core/cost.ts'
import type { UsageRecord } from '../core/cost.ts'
import { DEFAULT_CACHE_LIFETIME_MS } from '../core/cache.ts'
import type { Tips, UseCost } from '../core/summary.ts'
import { FIVE_MINUTES_MS, cacheLifetimeMs, coldRebuildWaste, isLargeContext } from '../core/tips.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const USES_SHOWN = 6

/** One request as the tips need it. */
export interface TipsRequest {
  id: string
  record: UsageRecord
  /** Milliseconds since the epoch, or NaN when the log had no usable time. */
  at: number
  isSidechain: boolean
  /** Within the last 30 calendar days. */
  isRecent: boolean
}

/** Where one log file's main conversation stands: its last request and cache lifetime. */
export interface FileState {
  lastAt: number | undefined
  lifetimeMs: number
  /** Claude Code tagged this file's requests with what they worked for (newer versions). */
  isTagged: boolean
}

export function fileState(): FileState {
  return { lastAt: undefined, lifetimeMs: FIVE_MINUTES_MS, isTagged: false }
}

export interface TipsTracker {
  now: number
  tips: Tips
  /** Skills and MCP servers each message called (`skill:<name>`, `mcp:<server>`). */
  uses: Map<string, Set<string>>
  /** Skills and MCP servers Claude Code tagged each message with, in the same form. */
  tagged: Map<string, Set<string>>
  /** Last-24-hours cost by message id, and its file, for attributing it. */
  dayCosts: Map<string, { cost: number; file: FileState }>
  /** The latest cache write: when, and how long it was to last. */
  latestWrite: { at: number; lifetimeMs: number } | undefined
}

export function tipsTracker(now: Date): TipsTracker {
  return {
    now: now.getTime(),
    tips: {
      last30: { cost: 0, coldRebuilds: 0, coldWaste: 0, largeContextCost: 0 },
      last24h: { cost: 0, largeContextCost: 0, skills: [], mcpServers: [] },
    },
    uses: new Map(),
    tagged: new Map(),
    dayCosts: new Map(),
    latestWrite: undefined,
  }
}

function addUses(into: Map<string, Set<string>>, id: string, uses: readonly string[]): void {
  if (uses.length === 0) return
  const known = into.get(id) ?? new Set<string>()
  for (const use of uses) known.add(use)
  into.set(id, known)
}

/**
 * Records what one log line of a message called, and what Claude Code tagged it with; a
 * message spans several lines.
 */
export function noteUses(
  tracker: TipsTracker,
  file: FileState,
  line: { id: string; uses: readonly string[]; attribution: readonly string[] | undefined },
): void {
  addUses(tracker.uses, line.id, line.uses)
  if (line.attribution === undefined) return
  file.isTagged = true
  addUses(tracker.tagged, line.id, line.attribution)
}

function noteColdRebuild(tracker: TipsTracker, file: FileState, request: TipsRequest): void {
  if (request.isSidechain || Number.isNaN(request.at)) return
  if (file.lastAt !== undefined && request.isRecent) {
    const waste = coldRebuildWaste(request.record, request.at - file.lastAt, file.lifetimeMs)
    if (waste > 0) {
      tracker.tips.last30.coldRebuilds += 1
      tracker.tips.last30.coldWaste += waste
    }
  }
  file.lastAt = request.at
  file.lifetimeMs = cacheLifetimeMs(request.record, file.lifetimeMs)
  const { cacheWrite5m, cacheWrite1h } = request.record.usage
  const latest = tracker.latestWrite
  if (cacheWrite5m + cacheWrite1h > 0 && (latest === undefined || request.at > latest.at)) {
    tracker.latestWrite = { at: request.at, lifetimeMs: file.lifetimeMs }
  }
}

/** Adds one request (once per message) to the 30-day and 24-hour tips. */
export function addTipsRequest(tracker: TipsTracker, file: FileState, request: TipsRequest): void {
  noteColdRebuild(tracker, file, request)
  const split = costOf(request.record)
  const cost = split === undefined ? 0 : totalCost(split)
  const isLarge = isLargeContext(request.record)
  const { last30, last24h } = tracker.tips
  if (request.isRecent) {
    last30.cost += cost
    if (isLarge) last30.largeContextCost += cost
  }
  if (Number.isNaN(request.at) || tracker.now - request.at > DAY_MS) return
  last24h.cost += cost
  if (isLarge) last24h.largeContextCost += cost
  tracker.dayCosts.set(request.id, { cost, file })
}

function ranked(costs: Map<string, number>): UseCost[] {
  return [...costs.entries()]
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, USES_SHOWN)
}

/** The latest write's cache lifetime, or one hour when the logs show none. */
export function latestCacheLifetimeMs(tracker: TipsTracker): number {
  return tracker.latestWrite?.lifetimeMs ?? DEFAULT_CACHE_LIFETIME_MS
}

export function tipsSummary(tracker: TipsTracker): Tips {
  const skills = new Map<string, number>()
  const servers = new Map<string, number>()
  // As /usage counts them: the requests tagged with a skill or server. Files without tags
  // (older versions) count the request that called it instead.
  for (const [id, { cost, file }] of tracker.dayCosts) {
    const uses = file.isTagged ? tracker.tagged : tracker.uses
    for (const use of uses.get(id) ?? []) {
      const cut = use.indexOf(':')
      const name = use.slice(cut + 1)
      const into = use.slice(0, cut) === 'skill' ? skills : servers
      into.set(name, (into.get(name) ?? 0) + cost)
    }
  }
  const { last30, last24h } = tracker.tips
  return { last30, last24h: { ...last24h, skills: ranked(skills), mcpServers: ranked(servers) } }
}
