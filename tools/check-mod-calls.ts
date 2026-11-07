/**
 * Anthropic's plugin directory reads a mod's engine calls from source, and only when `$`
 * and `on` stay in the hooks module (plugin/hooks/register.tsx). This rejects any file
 * under plugin/src that calls `$` or takes the engine or `on` as a parameter.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'plugin/src'
const FORBIDDEN = [
  { pattern: /\$\./, why: 'calls $ (engine calls belong in plugin/hooks/register.tsx)' },
  { pattern: /\bEngineInterface\b/, why: 'takes the engine ($) as a parameter' },
  {
    pattern: /import type \{[^}]*\bOn\b[^}]*\} from 'claude-code'/,
    why: 'takes on as a parameter',
  },
]

export function engineUses(path: string, source: string): string[] {
  const code = source
    .replace(/`[^`]*`/g, '``')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ why }) => `${path}: ${why}`)
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return files(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

if (import.meta.main) {
  const problems = files(ROOT).flatMap((path) => engineUses(path, readFileSync(path, 'utf8')))
  if (problems.length > 0) {
    process.stderr.write(
      `Engine calls outside the hooks module:\n${problems.map((p) => `  ${p}`).join('\n')}\n`,
    )
    process.exit(1)
  }
}
