import type { Register } from 'claude-code'

import { registerLive } from '../src/mod/live.ts'
import { registerPane } from '../src/mod/pane.tsx'

export const register: Register = (on) => {
  registerPane(on)
  registerLive(on)
}
