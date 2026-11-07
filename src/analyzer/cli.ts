/**
 * Prints a JSON summary of Claude Code usage:
 *   node src/analyzer/cli.ts [--project <repository folder>] [logs folder]
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { summarize } from './logs.ts'

const args = process.argv.slice(2)
const flag = args.indexOf('--project')
const project = flag >= 0 ? args[flag + 1] : undefined
const rest = flag >= 0 ? args.filter((_, index) => index !== flag && index !== flag + 1) : args
const root = rest[0] ?? join(homedir(), '.claude', 'projects')
process.stdout.write(`${JSON.stringify(await summarize(root, new Date(), { project }))}\n`)
