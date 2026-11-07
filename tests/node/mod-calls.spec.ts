import assert from 'node:assert/strict'
import { test } from 'node:test'

import { engineUses } from '../../tools/check-mod-calls.ts'

await test('engine calls and engine parameters outside the hooks module are rejected', () => {
  assert.deepEqual(engineUses('a.ts', 'const x = 1 + 2'), [])
  assert.deepEqual(engineUses('a.ts', 'const price = `${formatUsd(1)}`'), [])
  assert.equal(engineUses('a.ts', 'await $.process.run(argv)').length, 1)
  assert.equal(engineUses('a.ts', "import type { EngineInterface } from 'claude-code'").length, 1)
  assert.equal(engineUses('a.ts', "import type { On, Register } from 'claude-code'").length, 1)
  assert.deepEqual(engineUses('a.ts', '// $.ui.toast is called from register.tsx'), [])
})
