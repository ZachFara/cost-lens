/**
 * Recent sessions for the terminal view's Now tab: each session's latest main-thread
 * request (model, prompt size, cache lifetime), its title, and what it has cost so far.
 */
import { contextCost } from '../core/cache.ts'
import { costOf, promptTokens, totalCost } from '../core/cost.ts'
import type { UsageRecord } from '../core/cost.ts'
import { withTilde } from '../core/paths.ts'
import type { RecentSession } from '../core/summary.ts'
import { FIVE_MINUTES_MS, cacheLifetimeMs } from '../core/tips.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const SESSIONS_SHOWN = 8

interface Track {
  aiTitle: string
  customTitle: string
  cwd: string
  model: string
  /** The latest main-thread request, in milliseconds; undefined until there is one. */
  lastAt: number | undefined
  contextTokens: number
  lifetimeMs: number
  cost: number
  requests: number
}

export interface SessionTracker {
  now: number
  sessions: Map<string, Track>
}

export function sessionTracker(now: Date): SessionTracker {
  return { now: now.getTime(), sessions: new Map() }
}

function trackOf(tracker: SessionTracker, id: string): Track {
  let track = tracker.sessions.get(id)
  if (track === undefined) {
    track = {
      aiTitle: '',
      customTitle: '',
      cwd: '',
      model: '',
      lastAt: undefined,
      contextTokens: 0,
      lifetimeMs: FIVE_MINUTES_MS,
      cost: 0,
      requests: 0,
    }
    tracker.sessions.set(id, track)
  }
  return track
}

/**
 * A title line (`ai-title` from Claude Code, `custom-title` from the person); other lines
 * are ignored. The latest of each kind wins.
 */
export function noteTitle(tracker: SessionTracker, line: string): void {
  let entry: unknown
  try {
    entry = JSON.parse(line)
  } catch {
    return
  }
  if (typeof entry !== 'object' || entry === null) return
  const { type, sessionId, aiTitle, customTitle } = entry as Record<string, unknown>
  if (typeof sessionId !== 'string') return
  if (type === 'ai-title' && typeof aiTitle === 'string') {
    trackOf(tracker, sessionId).aiTitle = aiTitle
  }
  if (type === 'custom-title' && typeof customTitle === 'string') {
    trackOf(tracker, sessionId).customTitle = customTitle
  }
}

/** One request as the sessions need it. */
export interface SessionRequest {
  sessionId: string | undefined
  record: UsageRecord
  /** Milliseconds since the epoch, or NaN when the log had no usable time. */
  at: number
  cwd: string | undefined
  isSidechain: boolean
}

/** Adds one request (once per message): to the session's cost, and if newest, its state. */
export function trackSession(tracker: SessionTracker, request: SessionRequest): void {
  if (request.sessionId === undefined) return
  const track = trackOf(tracker, request.sessionId)
  const split = costOf(request.record)
  track.cost += split === undefined ? 0 : totalCost(split)
  track.requests += 1
  if (request.isSidechain || Number.isNaN(request.at)) return
  if (track.lastAt !== undefined && request.at < track.lastAt) return
  track.lastAt = request.at
  track.model = request.record.model
  track.contextTokens = promptTokens(request.record.usage)
  track.lifetimeMs = cacheLifetimeMs(request.record, track.lifetimeMs)
  if (request.cwd !== undefined) track.cwd = request.cwd
}

/** The sessions with a main-thread request in the last 24 hours, most recent first. */
export function recentSessions(tracker: SessionTracker, home: string): RecentSession[] {
  const recent: (Track & { lastAt: number })[] = []
  for (const track of tracker.sessions.values()) {
    const { lastAt } = track
    if (lastAt !== undefined && tracker.now - lastAt <= DAY_MS) recent.push({ ...track, lastAt })
  }
  return recent
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, SESSIONS_SHOWN)
    .map((track) => ({
      title: track.customTitle === '' ? track.aiTitle : track.customTitle,
      path: track.cwd === '' ? '' : withTilde(track.cwd, home),
      model: track.model,
      lastAt: new Date(track.lastAt).toISOString(),
      contextTokens: track.contextTokens,
      cacheLifetimeMs: track.lifetimeMs,
      next: contextCost(track.model, track.contextTokens, track.lifetimeMs) ?? null,
      cost: track.cost,
      requests: track.requests,
    }))
}
