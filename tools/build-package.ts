/**
 * Builds the npm package `cost-lens`, the terminal view as a command (decision 0008):
 *
 *   node tools/build-package.ts [out folder]   (dist/ by default; `npm run build`)
 *   npm publish ./dist                        (in a release, after the build)
 *
 * It compiles the terminal view, the analyzer it starts and core to JavaScript (Node does
 * not strip TypeScript types under node_modules) and writes a package.json of its own:
 * the command, the version, and no scripts or dependencies, so installing runs nothing.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

/** The compiled code needs no type stripping, so it runs on the Node the plugin asks for. */
const NODE = '>=22.18'

interface RootPackage {
  name: string
  version: string
  license: string
}

/** The published package's manifest, from the repository's own name, version and license. */
function manifest({ name, version, license }: RootPackage): Record<string, unknown> {
  return {
    name,
    version,
    description: 'See where your Claude Code tokens and dollars go, full screen in any terminal.',
    keywords: ['claude-code', 'claude', 'tokens', 'cost', 'usage', 'terminal', 'tui'],
    license,
    homepage: 'https://github.com/ZachFara/cost-lens#readme',
    repository: { type: 'git', url: 'git+https://github.com/ZachFara/cost-lens.git' },
    bugs: 'https://github.com/ZachFara/cost-lens/issues',
    type: 'module',
    bin: { [name]: 'terminal/cli.js' },
    engines: { node: NODE },
  }
}

export function buildPackage(out: string): void {
  rmSync(out, { recursive: true, force: true })
  execFileSync(process.execPath, [TSC, '-p', join(ROOT, 'tsconfig.build.json'), '--outDir', out], {
    stdio: 'inherit',
  })
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as RootPackage
  writeFileSync(join(out, 'package.json'), `${JSON.stringify(manifest(root), null, 2)}\n`)
  for (const file of ['README.md', 'LICENSE']) copyFileSync(join(ROOT, file), join(out, file))
}

if (import.meta.main) buildPackage(process.argv[2] ?? join(ROOT, 'dist'))
