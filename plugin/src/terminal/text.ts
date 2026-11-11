/**
 * Styled lines for the terminal view: text in spans, each with an optional tone, drawn
 * with the terminal's own 16 colors so its theme shows through.
 */

export type Tone =
  'success' | 'warning' | 'error' | 'suggestion' | 'permission' | 'dim' | 'bold' | 'selected'

export interface Span {
  text: string
  tone?: Tone
}

export type Line = readonly Span[]

export function span(text: string, tone?: Tone): Span {
  return tone === undefined ? { text } : { text, tone }
}

const GRAPHEMES = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** A string's characters as a reader sees them (an emoji with modifiers is one). */
function characters(text: string): string[] {
  return Array.from(GRAPHEMES.segment(text), (one) => one.segment)
}

/** How many cells a string takes, counting each character as one cell. */
export function cells(text: string): number {
  return characters(text).length
}

function cut(text: string, width: number): string {
  const chars = characters(text)
  if (chars.length <= width) return text
  return width <= 0 ? '' : `${chars.slice(0, width - 1).join('')}…`
}

/** Left text and right text on one line, the gap filling the width; the left is cut to fit. */
export function spread(left: Span, right: Span, width: number): Line {
  const room = Math.max(1, width - cells(right.text) - 1)
  const shown = { ...left, text: cut(left.text, room) }
  const gap = Math.max(1, width - cells(shown.text) - cells(right.text))
  return [shown, span(' '.repeat(gap)), right]
}

/** A word longer than the width, in pieces. */
function chunks(text: string, width: number): string[] {
  const chars = characters(text)
  if (chars.length <= width || width <= 0) return [text]
  const pieces: string[] = []
  for (let at = 0; at < chars.length; at += width) pieces.push(chars.slice(at, at + width).join(''))
  return pieces
}

/** Text broken into lines of at most `width` cells, at spaces where it can. */
export function wrap(text: string, width: number, tone?: Tone): Line[] {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    const next = current === '' ? word : `${current} ${word}`
    if (cells(next) <= width || current === '') {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  lines.push(current)
  return lines.flatMap((one) => chunks(one, width)).map((one) => [span(one, tone)])
}

const CODES: Record<Tone, string> = {
  success: '32',
  warning: '33',
  error: '31',
  suggestion: '34',
  permission: '35',
  dim: '2',
  bold: '1',
  selected: '7',
}

// Control characters (C0, DEL, C1) and bidirectional overrides and isolates.
const UNSAFE = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu

/**
 * Text from outside (PR titles, branch and folder names, error messages) as the terminal
 * should show it: a control character could move the cursor or change the terminal, so
 * each one reads as U+FFFD instead.
 */
export function printable(text: string): string {
  return text.replace(UNSAFE, '\ufffd')
}

/** A line as terminal text, cut to `width` cells; with `color`, its tones as ANSI codes. */
export function paint(line: Line, width: number, color: boolean): string {
  let left = width
  let out = ''
  for (const one of line) {
    if (left <= 0) break
    const safe = printable(one.text)
    const text = cells(safe) > left ? cut(safe, left) : safe
    left -= cells(text)
    out += color && one.tone !== undefined ? `\x1b[${CODES[one.tone]}m${text}\x1b[0m` : text
  }
  return out
}
