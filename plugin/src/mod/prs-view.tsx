import { totalCost } from '../core/cost.ts'
import { formatRequests, formatUsd } from '../core/format.ts'
import { costPullRequests } from '../core/pull-requests.ts'
import type { PullRequests } from '../../types'

import type { Ready, Ui } from './ui.ts'

const STATE_COLOR: Record<string, 'success' | 'permission' | undefined> = {
  OPEN: 'success',
  MERGED: 'permission',
}

/** A color when there is one, else dim text. */
function tone(color: 'success' | 'permission' | undefined) {
  return color === undefined ? { dimColor: true } : { color }
}

/** PRs: the repository's pull requests, each with what its head branch cost. */
export function prsView(ui: Ui, state: Ready, prs: PullRequests) {
  const { Box, Text } = ui
  if (prs.status === 'idle' || prs.status === 'loading') {
    return <Text dimColor>Listing pull requests with gh…</Text>
  }
  if (prs.status === 'error')
    return <Text color="warning">{`No pull requests: ${prs.message}`}</Text>
  const branches = state.summary.currentProject?.branches ?? []
  const rows = costPullRequests(prs.prs, branches)
  if (rows.length === 0) return <Text dimColor>This repository has no pull requests.</Text>
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">Pull requests, by what their branch cost</Text>
      {rows.map((one) => {
        const cost = one.spend ? formatUsd(totalCost(one.spend.cost)) : 'no Claude Code use'
        const requests = one.spend ? ` · ${formatRequests(one.spend.requests)}` : ''
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Text>{`#${String(one.number)} ${one.title}`}</Text>
              <Text {...tone(one.spend ? 'success' : undefined)}>{cost}</Text>
            </Box>
            <Box flexDirection="row" columnGap={1}>
              <Text {...tone(STATE_COLOR[one.state])}>{one.state.toLowerCase()}</Text>
              <Text dimColor>{`${one.branch}${requests}`}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
