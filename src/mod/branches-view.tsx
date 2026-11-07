import { totalCost } from '../core/cost.ts'
import { formatCount, formatUsd, formatWhen } from '../core/format.ts'

import type { Ready, Ui } from './ui.ts'

/** Branches: the current repository's branches, all time, most expensive first. */
export function branchesView(ui: Ui, state: Ready) {
  const { Box, Text } = ui
  const project = state.summary.currentProject
  if (project === null) return <Text dimColor>This session is not in a project folder.</Text>
  if (project.branches.length === 0) {
    return <Text dimColor>{`No Claude Code use recorded in ${project.path} yet.`}</Text>
  }
  const now = new Date(state.summary.generatedAt)
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">{`Branches in ${project.path}`}</Text>
      {project.branches.map(({ branch, spend }) => {
        const when = formatWhen(spend.lastActive, now)
        const details = `${formatCount(spend.requests)} requests${when === '' ? '' : ` · last active ${when}`}`
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Text>{branch === '' ? '(no branch)' : branch}</Text>
              <Text color="success">{formatUsd(totalCost(spend.cost))}</Text>
            </Box>
            <Text dimColor>{details}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
