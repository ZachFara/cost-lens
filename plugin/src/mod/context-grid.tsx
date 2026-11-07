import type { SessionContextBreakdown } from 'claude-code'

import { formatShare, formatTokens } from '../core/format.ts'

import type { Ui } from './ui.ts'

const FREE = 'Free space'

type Square = SessionContextBreakdown['gridRows'][number][number]

/** A square as /context draws it: full ■, partly full □, free space a dim dot. */
function glyph(square: Square): string {
  if (square.categoryName === FREE || !square.isFilled) return '·'
  return square.squareFullness >= 0.7 ? '■' : '□'
}

function gridRow(ui: Ui, row: readonly Square[]) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      {row.map((square) =>
        square.categoryName === FREE || !square.isFilled ? (
          <Text dimColor>{`${glyph(square)} `}</Text>
        ) : (
          <Text color={square.color}>{`${glyph(square)} `}</Text>
        ),
      )}
    </Box>
  )
}

/** The context window as /context draws it: one square per slice, colored by what fills it. */
export function contextGrid(ui: Ui, breakdown: SessionContextBreakdown) {
  const { Box, Text } = ui
  const rows = breakdown.categories
    .filter((one) => one.tokens > 0 && (one.kind === 'used' || one.name === FREE))
    .sort((a, b) => Number(a.name === FREE) - Number(b.name === FREE) || b.tokens - a.tokens)
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">
        {`Context window · ${formatTokens(breakdown.totalTokens)} of ${formatTokens(breakdown.maxTokens)}`}
      </Text>
      <Box flexDirection="column">{breakdown.gridRows.map((row) => gridRow(ui, row))}</Box>
      <Box flexDirection="column">
        {rows.map((one) => (
          <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
            <Box flexDirection="row" columnGap={1}>
              {one.name === FREE ? <Text dimColor>·</Text> : <Text color={one.color}>■</Text>}
              <Text>{one.name}</Text>
            </Box>
            <Text dimColor>
              {`${formatTokens(one.tokens)} (${formatShare(one.tokens / breakdown.maxTokens)})`}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
