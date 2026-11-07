import type { Register } from 'claude-code'

import { registerPane } from '../src/mod/pane.tsx'

export const register: Register = (on) => {
  registerPane(on)
}
