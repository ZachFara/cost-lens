import type { BoxProps, ButtonProps, ElementConstructor, TextProps } from 'claude-code'

import type { History } from '../../types'

/** The elements every surface draws, as `$.ui.resolve(e)` hands them out. */
export interface Ui {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

/** What the data tabs' buttons do. */
export interface Actions {
  load: () => void
  refresh: () => void
}

export type Ready = Extract<History, { status: 'ready' }>
