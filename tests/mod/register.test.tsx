import { expect, test } from 'claude-code/testing'

test('the mod loads and leaves session start to the engine', async ($, on) => {
  // Nothing sits beneath the plugin in a test: this hook stands for the engine.
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  const started = await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(started).toEqual({ cwd: '/' })
})
