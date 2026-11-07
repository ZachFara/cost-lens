import { formatClock } from '../core/format.ts'
import { TIERS, familyOf, priceComparison } from '../core/models.ts'
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

function latestCard(ui: Ui, latest: Recommendation, current: string) {
  const { Box, Text } = ui
  const fit = TIERS.find((one) => one.model === latest.model)
  if (fit === undefined) return null
  const isOn = familyOf(current) === fit.family
  const comparison = priceComparison(current, fit.model)
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

function historyView(ui: Ui, recent: readonly Recommendation[]) {
  const { Box, Text } = ui
  if (recent.length < 2) return null
  return (
    <Box flexDirection="column">
      <Text weight="semibold">Recent prompts</Text>
      {recent.map((one) => {
        const fit = TIERS.find((tier) => tier.model === one.model)
        return (
          <Text dimColor>
            {`${formatClock(new Date(one.at).toISOString())}  ${one.tier} → ${fit?.name ?? one.model} (on ${one.current})`}
          </Text>
        )
      })}
    </Box>
  )
}

function tiersView(ui: Ui) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column">
      <Text weight="semibold">How prompts are judged</Text>
      {TIERS.map((one) => (
        <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Text>{one.label}</Text>
          <Text dimColor>{one.name}</Text>
        </Box>
      ))}
    </Box>
  )
}

/** Model: which model fits the last prompts, with the settings that govern it. */
export function modelView(
  ui: Ui,
  settings: Settings,
  recent: readonly Recommendation[],
  current: string,
) {
  const { Box, Text } = ui
  if (!settings.llmFeatures) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text weight="semibold">Model recommendations are off</Text>
        <Text>{OFF_TEXT}</Text>
        {tiersView(ui)}
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
        latestCard(ui, latest, current)
      )}
      {historyView(ui, recent)}
      {tiersView(ui)}
      {settingsLine(ui, settings)}
    </Box>
  )
}
