import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { DEFAULT_CACHE_LIFETIME_MS, cacheMsLeft, contextCost } from '../core/cache.ts'
import { formatDuration, formatTokens, formatUsd } from '../core/format.ts'
import type { LastRequest } from '../../types'

import { readHistory } from './history.ts'

// Change a tag when its value's fields change: it declines what an earlier version stored.
const lastRequest = atom({ plugin: 'cost-lens', key: 'lastRequest' } as const, null, {
  shape: 'last-request-1',
})
const isBandHidden = atom({ plugin: 'cost-lens', key: 'isBandHidden' } as const, false)
/** Bumped every minute so the band's countdown redraws. */
const minute = atom({ plugin: 'cost-lens', key: 'minute' } as const, 0)

const MINUTE_MS = 60 * 1000

/** Remembers the main conversation's latest request: what the next message builds on. */
export async function recordMainRequest($: EngineInterface, request: LastRequest): Promise<void> {
  await update($, lastRequest, () => request)
}

/** The last request and the cache lifetime, for the band and the cold-cache warning. */
async function readCache($: EngineInterface) {
  const [request, history] = await Promise.all([read($, lastRequest), readHistory($)])
  const lifetimeMs =
    history.status === 'ready' ? history.summary.cacheLifetimeMs : DEFAULT_CACHE_LIFETIME_MS
  return { request, lifetimeMs }
}

/** The band's one line: a warm countdown, or what a cold cache will cost to re-write. */
function bandText(request: LastRequest, lifetimeMs: number, now: number) {
  const left = cacheMsLeft(now, request.at, lifetimeMs)
  const context = formatTokens(request.promptTokens)
  if (left > 0) {
    return { isWarm: true, text: `cache warm · ${formatDuration(left)} left · ${context} context` }
  }
  const cost = contextCost(request.model, request.promptTokens, lifetimeMs)
  const price =
    cost === undefined ? '' : ` ≈ ${formatUsd(cost.cold)} (warm: ${formatUsd(cost.warm)})`
  return { isWarm: false, text: `cache cold · next message re-writes ${context} tokens${price}` }
}

/** Redraws the band's countdown once a minute; started by the module's one session.start hook. */
export function startBandClock($: EngineInterface): void {
  $.clock.every(MINUTE_MS, () => {
    void update($, minute, (count) => count + 1)
  })
}

/** A line above the prompt with the cache's state; `/cost-lens band` brings it back if hidden. */
export function registerBand(on: On): void {
  on('command.run', { command: 'cost-lens', args: 'band' }, async ($) => {
    await update($, isBandHidden, () => false)
    return { text: 'cost-lens cache line shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, minute)
    const { request, lifetimeMs } = await readCache($)
    if (e.props.hasSurvey || request === null || (await read($, isBandHidden))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const line = bandText(request, lifetimeMs, await $.clock.now())
    return (
      <Box flexDirection="row" columnGap={1}>
        <Text color={line.isWarm ? 'success' : 'warning'}>●</Text>
        <Text dimColor={line.isWarm}>{`cost-lens · ${line.text}`}</Text>
        <Button
          key="hide-band"
          label="Hide"
          plain
          dimColor
          onPress={() => {
            void update($, isBandHidden, () => true)
          }}
        />
      </Box>
    )
  })
}
