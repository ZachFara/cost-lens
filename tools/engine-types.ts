/**
 * The mod's API types are written by Claude Code itself and are not committed (decision 0004).
 *
 *   node tools/engine-types.ts sync [source]  copy them into vendor/ from where the engine wrote them
 *   node tools/engine-types.ts typecheck      type-check the mod against them
 *
 * Without them, typecheck fails locally and prints a notice in CI, where they cannot exist.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'

export const VENDORED = 'vendor/claude-code/index.d.ts'
const ENGINE_WRITTEN = 'plugin/.claude-plugin/types/claude-code/index.d.ts'
const HEADER = /^\/\/ Written by Claude Code (\S+)\./

export function versionOf(declarations: string): string | undefined {
  return HEADER.exec(declarations)?.[1]
}

function pinnedVersion(): string {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    devDependencies: Record<string, string>
  }
  const version = pkg.devDependencies['@anthropic-ai/claude-code']
  if (version === undefined) throw new Error('package.json does not pin @anthropic-ai/claude-code')
  return version
}

function assertPinned(path: string): void {
  const found = versionOf(readFileSync(path, 'utf8'))
  const pinned = pinnedVersion()
  if (found !== pinned) {
    throw new Error(`${path} was written by Claude Code ${String(found)}; the pin is ${pinned}`)
  }
}

function sync(source: string): void {
  if (!existsSync(source)) {
    throw new Error(
      `${source} does not exist. Open this folder once in an interactive session ` +
        '(claude --plugin-dir plugin) so the engine writes it, or pass another path.',
    )
  }
  assertPinned(source)
  mkdirSync('vendor/claude-code', { recursive: true })
  copyFileSync(source, VENDORED)
  process.stdout.write(`Copied ${source} to ${VENDORED}\n`)
}

function typecheck(): void {
  if (existsSync(VENDORED)) {
    assertPinned(VENDORED)
    execFileSync('node_modules/.bin/tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit' })
    return
  }
  if (process.env.CI === 'true') {
    process.stdout.write(`Notice: ${VENDORED} is not available in CI; mod type check skipped.\n`)
    return
  }
  throw new Error(`${VENDORED} is missing. Run: npm run engine-types`)
}

if (import.meta.main) {
  const [command, source] = process.argv.slice(2)
  if (command === 'sync') sync(source ?? ENGINE_WRITTEN)
  else if (command === 'typecheck') typecheck()
  else throw new Error('Usage: node tools/engine-types.ts sync [source] | typecheck')
}
