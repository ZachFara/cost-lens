import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { localDay } from '../../plugin/src/core/days.ts'
import { buildPackage } from '../../tools/build-package.ts'

/**
 * The environment without git's own variables: a git hook (the pre-push check) exports
 * GIT_DIR, which would put the temporary folder inside this repository.
 */
function outsideGit(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')))
}

interface Packed {
  files: { path: string }[]
}

const root = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

await test('the npm package is the terminal view as a command, and installing runs nothing', () => {
  const out = mkdtempSync(join(tmpdir(), 'cost-lens-package-'))
  const home = mkdtempSync(join(tmpdir(), 'cost-lens-home-'))
  try {
    buildPackage(out)
    const manifest = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >
    assert.equal(manifest.name, '@zachfara/cost-lens')
    assert.deepEqual(manifest.publishConfig, { access: 'public' })
    assert.equal(manifest.version, root.version)
    assert.deepEqual(manifest.bin, { 'cost-lens': 'terminal/cli.js' })
    assert.equal(manifest.scripts, undefined)
    assert.equal(manifest.dependencies, undefined)

    const [packed] = JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: out, encoding: 'utf8' }),
    ) as Packed[]
    const paths = (packed?.files ?? []).map((file) => file.path)
    assert.ok(paths.includes('terminal/cli.js') && paths.includes('analyzer/cli.js'))
    const unexpected = paths.filter(
      (path) =>
        !/^(terminal|analyzer|core)\/[a-z0-9-]+\.js$/.test(path) &&
        !['package.json', 'README.md', 'LICENSE'].includes(path),
    )
    assert.deepEqual(unexpected, [])

    const command = join(out, 'terminal', 'cli.js')
    assert.match(readFileSync(command, 'utf8'), /^#!\/usr\/bin\/env node\n/)
    const usage = execFileSync(process.execPath, [command, '--help'], { encoding: 'utf8' })
    assert.match(usage, /^Usage: cost-lens/)
    // The compiled command starts the compiled analyzer: an empty logs folder reads as no use.
    mkdirSync(join(home, 'logs'))
    const cache = join(home, 'Library', 'Caches', 'cost-lens')
    mkdirSync(cache, { recursive: true })
    const today = localDay(new Date())
    const rates = { input: 5, write5m: 6.25, write1h: 10, read: 0.5, output: 25 }
    writeFileSync(
      join(cache, 'prices.json'),
      JSON.stringify({ fetched: today, models: [{ id: 'claude-opus-5-5', rates }] }),
    )
    const printed = execFileSync(process.execPath, [command, join(home, 'logs')], {
      cwd: home,
      encoding: 'utf8',
      env: outsideGit({ ...process.env, HOME: home }),
    })
    assert.match(printed, /No Claude Code use today yet\./)
  } finally {
    rmSync(out, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
})
