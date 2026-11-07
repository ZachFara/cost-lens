import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { disallowedPaths } from '../../tools/check-layout.ts'
import { versionOf } from '../../tools/engine-types.ts'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'))
}

await test('the plugin manifest and package agree on name and version', () => {
  const manifest = readJson('.claude-plugin/plugin.json') as { name: string; version: string }
  const pkg = readJson('package.json') as { name: string; version: string }
  assert.equal(manifest.name, pkg.name)
  assert.equal(manifest.version, pkg.version)
})

await test('the layout check accepts the layout and rejects stray files', () => {
  assert.deepEqual(disallowedPaths(['src/core/pricing.ts', 'hooks/register.tsx']), [])
  assert.deepEqual(disallowedPaths(['scratch.ts', 'src/util/helpers.ts']), [
    'scratch.ts',
    'src/util/helpers.ts',
  ])
})

await test('engine types are recognized by the Claude Code version in their header', () => {
  assert.equal(versionOf('// Written by Claude Code 2.1.319.\n// more'), '2.1.319')
  assert.equal(versionOf('export {}'), undefined)
})

await test('the license is declared the same way everywhere', () => {
  const manifest = readJson('.claude-plugin/plugin.json') as { license: string }
  const pkg = readJson('package.json') as { license: string }
  const text = readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8')
  assert.equal(manifest.license, 'MIT')
  assert.equal(pkg.license, 'MIT')
  assert.match(text, /^MIT License/)
})
