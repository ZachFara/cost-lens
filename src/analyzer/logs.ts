import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { addRecord, emptyTotals } from '../core/cost.ts'
import type { Totals, UsageRecord } from '../core/cost.ts'
import { PRICES_FETCHED } from '../core/pricing.ts'
import type { Summary } from '../core/summary.ts'

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
export function recordFromLine(line: string): { id: string; record: UsageRecord } | undefined {
  const message = assistantMessage(line)
  const usage = asObject(message?.usage)
  const id = text(message?.id)
  const model = text(message?.model)
  if (!usage || !id || !model || model === '<synthetic>') return undefined
  return { id, record: usageRecord(model, usage) }
}

function assistantMessage(line: string): Json | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return undefined
  }
  const entry = asObject(parsed)
  return entry?.type === 'assistant' ? asObject(entry.message) : undefined
}

async function logFiles(root: string): Promise<string[]> {
  try {
    const names = await readdir(root, { recursive: true })
    return names.filter((name) => name.endsWith('.jsonl')).sort()
  } catch {
    return []
  }
}

async function addFile(path: string, seen: Set<string>, totals: Totals): Promise<void> {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.includes('"usage"')) continue
    const found = recordFromLine(line)
    if (found === undefined || seen.has(found.id)) continue
    seen.add(found.id)
    addRecord(totals, found.record)
  }
}

/** Reads every session log under `root` (Claude Code keeps them in ~/.claude/projects). */
export async function summarize(root: string, now: Date): Promise<Summary> {
  const totals = emptyTotals()
  const seen = new Set<string>()
  for (const name of await logFiles(root)) {
    await addFile(join(root, name), seen, totals)
  }
  return { generatedAt: now.toISOString(), pricesFetched: PRICES_FETCHED, allTime: totals }
}
