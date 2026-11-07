import { expect, test } from 'claude-code/testing'

test('the mod loads and leaves session start to the engine', async ($, on) => {
  // Nothing sits beneath the plugin in a test: these hooks stand for the engine.
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  const started = await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(started).toEqual({ cwd: '/' })
})
