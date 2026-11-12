import { totalCost } from '../core/cost.ts'
import { formatRequests, formatUsd, formatWhen } from '../core/format.ts'

import type { Ready, Ui } from './ui.ts'

function splitPath(path: string): { name: string; folder: string } {
  const cut = path.lastIndexOf('/')
  return cut < 0
    ? { name: path, folder: '' }
    : { name: path.slice(cut + 1), folder: path.slice(0, cut) }
}

/** Projects: the last 30 days' most expensive working folders. */
export function projectsView(ui: Ui, state: Ready) {
  const { Box, Text } = ui
  const { projects, generatedAt } = state.summary
  if (projects.length === 0) return <Text dimColor>No Claude Code use in the last 30 days.</Text>
  const now = new Date(generatedAt)
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">Last 30 days, by project</Text>
      {projects.map((project) => {
        const { name, folder } = splitPath(project.path)
        const when = formatWhen(project.last30.lastActive, now)
        const details = [
          folder,
          formatRequests(project.last30.requests),
          when === '' ? '' : `last active ${when}`,
        ].filter((part) => part !== '')
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Text>{name === '' ? project.path : name}</Text>
              <Text color="success">{formatUsd(totalCost(project.last30.cost))}</Text>
            </Box>
            <Text dimColor>{details.join(' · ')}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
