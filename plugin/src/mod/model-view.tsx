import { formatClock } from '../core/format.ts'
import { familyOf, priceComparison } from '../core/models.ts'
import type { TierModel } from '../core/models.ts'
import type { PriceTable } from '../core/pricing.ts'
import type { Recommendation } from '../../types'

import type { Settings } from './settings.ts'
import type { Ui } from './ui.ts'

const OFF_TEXT =
  'To recommend a model, a small Claude model (Haiku) reads the text of each prompt you ' +
  'type of 40 characters or more. Turn on "Allow LLM features" in /config, under cost-lens.'

function settingsLine(ui: Ui, settings: Settings) {
  const llm = settings.llmFeatures ? 'on' : 'off'
  const alerts = settings.recommendationAlerts ? 'on' : 'off'
  return (
    <ui.Text
      dimColor
    >{`LLM features: ${llm} · notifications: ${alerts} · change in /config`}</ui.Text>
  )
}

function latestCard(ui: Ui, facts: ModelFacts, latest: Recommendation) {
  const { Box, Text } = ui
  const { current } = facts
  const fit = facts.tiers.find((one) => one.tier === latest.tier)
  if (fit === undefined) return null
  const isOn = familyOf(current) === fit.family
  const comparison = priceComparison(current, fit.model, facts.prices)
  const detail = isOn
    ? `You're on ${current}: it fits.`
    : `You're on ${current}${comparison === undefined ? '' : ` · ${comparison}`} · /model ${fit.alias}`
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text weight="semibold">{`Last prompt looks ${fit.tier}`}</Text>
      <Text color={isOn ? 'success' : 'warning'}>{`${fit.name} fits`}</Text>
      <Text dimColor>{detail}</Text>
    </Box>
  )
}

function historyView(ui: Ui, tiers: readonly TierModel[], recent: readonly Recommendation[]) {
  const { Box, Text } = ui
  if (recent.length < 2) return null
  return (
    <Box flexDirection="column">
      <Text weight="semibold">Recent prompts</Text>
      {recent.map((one) => {
        const fit = tiers.find((tier) => tier.model === one.model)
        return (
          <Text dimColor>
            {`${formatClock(new Date(one.at).toISOString())}  ${one.tier} → ${fit?.name ?? one.model} (on ${one.current})`}
          </Text>
        )
      })}
    </Box>
  )
}

function tiersView(ui: Ui, tiers: readonly TierModel[]) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column">
      <Text weight="semibold">How prompts are judged</Text>
      {tiers.map((one) => (
        <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Text>{one.label}</Text>
          <Text dimColor>{one.name}</Text>
        </Box>
      ))}
    </Box>
  )
}

export interface ModelFacts {
  settings: Settings
  /** Each tier with the model it recommends today. */
  tiers: readonly TierModel[]
  /** Recent recommendations, newest first. */
  recent: readonly Recommendation[]
  /** The session's model ('' while LLM features are off). */
  current: string
  /** The last summary's prices; the built-in snapshot's when undefined. */
  prices?: PriceTable | undefined
}

/** Model: which model fits the last prompts, with the settings that govern it. */
export function modelView(ui: Ui, facts: ModelFacts) {
  const { Box, Text } = ui
  const { settings, tiers, recent } = facts
  if (!settings.llmFeatures) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text weight="semibold">Model recommendations are off</Text>
        <Text>{OFF_TEXT}</Text>
        {tiersView(ui, tiers)}
        {settingsLine(ui, settings)}
      </Box>
    )
  }
  const latest = recent[0]
  return (
    <Box flexDirection="column" gap={1}>
      {latest === undefined ? (
        <Text dimColor>
          Send a prompt of 40 characters or more and the model that fits it appears here.
        </Text>
      ) : (
        latestCard(ui, facts, latest)
      )}
      {historyView(ui, tiers, recent)}
      {tiersView(ui, tiers)}
      {settingsLine(ui, settings)}
    </Box>
  )
}
