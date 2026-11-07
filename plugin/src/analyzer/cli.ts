/**
 * Prints a JSON summary of Claude Code usage:
 *   node src/analyzer/cli.ts [--project <repository folder>] [--live-prices] [logs folder]
 *
 * --live-prices prices with today's copy of Anthropic's pricing page (fetched at most once
 * a day and cached), falling back to the built-in snapshot.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { usePrices } from '../core/pricing.ts'

import { summarize } from './logs.ts'
import { livePrices } from './prices.ts'

const args = process.argv.slice(2)
const flag = args.indexOf('--project')
const project = flag >= 0 ? args[flag + 1] : undefined
const rest = args.filter(
  (arg, index) => arg !== '--live-prices' && (flag < 0 || (index !== flag && index !== flag + 1)),
)
const root = rest[0] ?? join(homedir(), '.claude', 'projects')
if (args.includes('--live-prices')) {
  const live = await livePrices(new Date())
  if (live !== undefined) usePrices(live.models, live.fetched)
}
process.stdout.write(`${JSON.stringify(await summarize(root, new Date(), { project }))}\n`)
