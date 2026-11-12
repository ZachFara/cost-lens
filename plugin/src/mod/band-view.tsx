import { cacheMsLeft, contextCost } from '../core/cache.ts'
import { formatDuration, formatTokens, formatUsd } from '../core/format.ts'
import type { PriceTable } from '../core/pricing.ts'
import type { LastRequest } from '../../types'

import type { Ui } from './ui.ts'

/** The band's one line: a warm countdown, or what a cold cache will cost to re-write. */
function bandText({ request, lifetimeMs, now, prices }: BandData) {
  const left = cacheMsLeft(now, request.at, lifetimeMs)
  const context = formatTokens(request.promptTokens)
  if (left > 0) {
    return { isWarm: true, text: `cache warm · ${formatDuration(left)} left · ${context} context` }
  }
  const cost = contextCost(request.model, request.promptTokens, lifetimeMs, prices)
  const price =
    cost === undefined ? '' : ` ≈ ${formatUsd(cost.cold)} (warm: ${formatUsd(cost.warm)})`
  return { isWarm: false, text: `cache cold · next message re-writes ${context} tokens${price}` }
}

export interface BandData {
  request: LastRequest
  lifetimeMs: number
  now: number
  /** The last summary's prices; the built-in snapshot's when undefined. */
  prices?: PriceTable | undefined
}

/** The line above the prompt, with a Hide button. */
export function bandView(ui: Ui, data: BandData, onHide: () => void) {
  const { Box, Button, Text } = ui
  const line = bandText(data)
  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={line.isWarm ? 'success' : 'warning'}>●</Text>
      <Text dimColor={line.isWarm}>{`cost-lens · ${line.text}`}</Text>
      <Button key="hide-band" label="Hide" plain dimColor onPress={onHide} />
    </Box>
  )
}
