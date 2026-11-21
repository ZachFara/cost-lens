/**
 * Draws the terminal view to a PNG, to look at a layout change as a person would see it:
 *   node tools/screenshot.ts <out.png> [columns] [rows] [keys]
 *
 * It runs the view in a detached tmux session, presses `keys` (such as 2 for Today),
 * reads the screen with its colours, and draws it with headless Chrome in kitty's font
 * and colours (~/.config/kitty/kitty.conf and what it includes), else in defaults.
 * Needs tmux and Google Chrome; macOS only.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SESSION = 'cost-lens-screenshot'
const LOAD_TIMEOUT_MS = 90_000

// shortcut: kitty's cell is this many font sizes tall with JetBrains Mono (measured from
// a screenshot); measure again if another font draws visibly taller or shorter rows.
const CELL_HEIGHT = 1.14
const CELL_WIDTH = 0.6

/** The 16 colours, the two base colours, and the font: kitty's names for them. */
const DEFAULTS: Record<string, string> = {
  font_family: 'Menlo',
  font_size: '14',
  dim_opacity: '0.4',
  foreground: '#dddddd',
  background: '#000000',
  ...Object.fromEntries(
    ['#000000', '#cc0403', '#19cb00', '#cecb00', '#0d73cc', '#cb1ed1', '#0dcdcd', '#dddddd']
      .concat(
        '#767676',
        '#f2201f',
        '#23fd00',
        '#fffd00',
        '#1a8fff',
        '#fd28ff',
        '#14ffff',
        '#ffffff',
      )
      .map((color, index) => [`color${String(index)}`, color]),
  ),
}

/** A kitty config file's settings, with the files it includes. */
function kittySettings(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const settings: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [, key, value] = /^\s*([a-z_0-9]+)\s+(.+?)\s*$/.exec(line) ?? []
    if (key === undefined || value === undefined) continue
    if (key === 'include') Object.assign(settings, kittySettings(resolve(dirname(path), value)))
    else settings[key] = value
  }
  return settings
}

function tmux(...args: string[]): string {
  return execFileSync('tmux', args, { encoding: 'utf8' })
}

/** The view's screen with its escape codes, once the logs are read and `keys` pressed. */
async function capture(columns: number, rows: number, keys: string): Promise<string> {
  const cli = resolve('plugin/src/terminal/cli.ts')
  const size = ['-x', String(columns), '-y', String(rows)]
  tmux('new-session', '-d', '-s', SESSION, ...size, `node ${JSON.stringify(cli)}`)
  try {
    const deadline = Date.now() + LOAD_TIMEOUT_MS
    while (!tmux('capture-pane', '-p', '-t', SESSION).includes('Read at ')) {
      if (Date.now() > deadline) throw new Error('the view did not finish reading the logs')
      await sleep(500)
    }
    for (const key of keys) {
      tmux('send-keys', '-t', SESSION, key)
      await sleep(300)
    }
    return tmux('capture-pane', '-e', '-p', '-t', SESSION)
  } finally {
    tmux('kill-session', '-t', SESSION)
  }
}

interface Style {
  color: number | undefined
  isBold: boolean
  isDim: boolean
  isReversed: boolean
}

const PLAIN: Style = { color: undefined, isBold: false, isDim: false, isReversed: false }

/** What an SGR code changes; colours and the reset are handled in `styled`. */
const SGR: Record<number, Partial<Style>> = {
  1: { isBold: true },
  2: { isDim: true },
  7: { isReversed: true },
  22: { isBold: false, isDim: false },
  27: { isReversed: false },
  39: { color: undefined },
}

/** A style after one SGR code; codes the view never sends are ignored. */
function styled(style: Style, code: number): Style {
  if (code === 0) return PLAIN
  if (code >= 30 && code <= 37) return { ...style, color: code - 30 }
  if (code >= 90 && code <= 97) return { ...style, color: code - 90 + 8 }
  return { ...style, ...SGR[code] }
}

/** The font and colours to draw with. */
interface Theme {
  font: string
  size: number
  /** How much of a dim text's colour shows over the background, 0 to 1. */
  dim: number
  foreground: string
  background: string
  colors: string[]
}

function themeOf(settings: Record<string, string>): Theme {
  const all = { ...DEFAULTS, ...settings }
  const get = (key: string) => all[key] ?? ''
  return {
    font: get('font_family'),
    size: Number(get('font_size')),
    dim: Number(get('dim_opacity')),
    foreground: get('foreground'),
    background: get('background'),
    colors: Array.from({ length: 16 }, (_, index) => get(`color${String(index)}`)),
  }
}

function mix(color: string, share: number, theme: Theme): string {
  return `color-mix(in srgb, ${color} ${String(share * 100)}%, ${theme.background})`
}

function colorOf(style: Style, theme: Theme): string {
  const base = style.color === undefined ? theme.foreground : theme.colors[style.color]
  return style.isDim ? mix(base ?? theme.foreground, theme.dim, theme) : (base ?? theme.foreground)
}

/** kitty fills the cell for a block and shades it for a shade; a font's glyph leaves gaps. */
const FILLS: Record<string, number> = { '█': 1, '░': 0.33 }

/** A run of text, all blocks, all shades or neither, as HTML. */
function spanHtml(text: string, style: Style, theme: Theme): string {
  const color = colorOf(style, theme)
  const fill = FILLS[text[0] ?? '']
  const css = [`color:${style.isReversed ? theme.background : color}`]
  if (style.isReversed) css.push(`background:${color}`)
  if (fill !== undefined) css.push(`background:${mix(color, fill, theme)}`)
  if (style.isBold) css.push('font-weight:bold')
  const shown =
    fill === undefined ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;') : ' '.repeat(text.length)
  return `<span style="${css.join(';')}">${shown}</span>`
}

function runsHtml(text: string, style: Style, theme: Theme): string {
  return (text.match(/█+|░+|[^█░]+/g) ?? []).map((run) => spanHtml(run, style, theme)).join('')
}

/** The captured screen as an HTML page. */
function pageHtml(screen: string, theme: Theme): string {
  // Each part after the first starts with an escape sequence's codes, up to its "m".
  const [first = '', ...parts] = screen.split('\u001b[')
  let style = PLAIN
  let body = runsHtml(first, style, theme)
  for (const part of parts) {
    const end = part.indexOf('m')
    for (const code of part.slice(0, end).split(';')) style = styled(style, Number(code))
    body += runsHtml(part.slice(end + 1), style, theme)
  }
  const font = `"${theme.font}", "JetBrainsMono Nerd Font Mono", Menlo, monospace`
  const css =
    `margin:0;background:${theme.background};white-space:pre;` +
    `font:${String(theme.size)}px/${String(theme.size * CELL_HEIGHT)}px ${font}`
  return `<!doctype html><meta charset="utf-8"><body style='${css}'>${body}</body>`
}

const [out, columnsArg = '100', rowsArg = '40', keys = ''] = process.argv.slice(2)
if (out === undefined) {
  process.stderr.write('Usage: node tools/screenshot.ts <out.png> [columns] [rows] [keys]\n')
  process.exit(1)
}
const theme = themeOf(kittySettings(join(homedir(), '.config', 'kitty', 'kitty.conf')))
const columns = Number(columnsArg)
const rows = Number(rowsArg)
const folder = mkdtempSync(join(tmpdir(), 'cost-lens-screenshot-'))
try {
  const page = join(folder, 'screen.html')
  writeFileSync(page, pageHtml(await capture(columns, rows, keys), theme))
  const { size } = theme
  const window = `${String(Math.ceil(columns * size * CELL_WIDTH))},${String(Math.ceil(rows * size * CELL_HEIGHT))}`
  execFileSync(
    CHROME,
    [
      '--headless=new',
      `--user-data-dir=${join(folder, 'chrome')}`,
      `--screenshot=${resolve(out)}`,
      `--window-size=${window}`,
      '--force-device-scale-factor=2',
      '--hide-scrollbars',
      `file://${page}`,
    ],
    { stdio: 'ignore' },
  )
} finally {
  rmSync(folder, { recursive: true, force: true })
}
