import type { Register } from 'claude-code'

import { registerBand } from '../src/mod/cache-band.tsx'
import { registerPromptSubmit } from '../src/mod/prompt-submit.ts'
import { registerLive } from '../src/mod/live.ts'
import { registerPane } from '../src/mod/pane.tsx'
import { readSettings } from '../src/mod/settings.ts'

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  registerPane(on, settings)
  registerLive(on)
  registerBand(on)
  registerPromptSubmit(on, settings)
}
