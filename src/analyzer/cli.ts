/** Prints a JSON summary of Claude Code usage: node src/analyzer/cli.ts [logs folder] */
import { homedir } from 'node:os'
import { join } from 'node:path'

import { summarize } from './logs.ts'

const root = process.argv[2] ?? join(homedir(), '.claude', 'projects')
process.stdout.write(`${JSON.stringify(await summarize(root, new Date()))}\n`)
