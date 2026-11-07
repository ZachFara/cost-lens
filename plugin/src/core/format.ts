const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const COUNT = new Intl.NumberFormat('en-US')

export function formatUsd(amount: number): string {
  return USD.format(amount)
}

export function formatCount(count: number): string {
  return COUNT.format(count)
}

/** A share from 0 to 1 as a whole percentage; a small non-zero share reads "<1%". */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.005) return '<1%'
  return `${String(Math.round(share * 100))}%`
}

/** An ISO timestamp as local wall-clock time, `HH:MM`. */
export function formatClock(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A token count in short form: 950, 12.3k, 1.2M. */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(Math.round(count))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** When something last happened: "today 11:42", or "Nov 5" for an earlier day; '' stays ''. */
export function formatWhen(iso: string, now: Date): string {
  if (iso === '') return ''
  const date = new Date(iso)
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) return `today ${formatClock(iso)}`
  return `${MONTHS[date.getMonth()] ?? ''} ${String(date.getDate())}`
}

/**
 * Splits `width` cells among values in proportion, using largest remainders so the
 * widths always add up to `width` (or to 0 when every value is 0).
 */
export function barWidths(values: readonly number[], width: number): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map((value) => (value / total) * width)
  const widths = exact.map(Math.floor)
  let left = width - widths.reduce((sum, cells) => sum + cells, 0)
  const byRemainder = exact
    .map((cells, index) => ({ index, remainder: cells - Math.floor(cells) }))
    .sort((a, b) => b.remainder - a.remainder)
  for (const { index } of byRemainder) {
    if (left === 0) break
    widths[index] = (widths[index] ?? 0) + 1
    left -= 1
  }
  return widths
}

/** When a usage window resets: "Resets 12:40" today, else "Resets Nov 12 at 22:59". */
export function formatResets(iso: string, now: Date): string {
  const when = formatWhen(iso, now)
  if (when === '') return ''
  return when.startsWith('today ')
    ? `Resets ${when.slice('today '.length)}`
    : `Resets ${when} at ${formatClock(iso)}`
}

/** A short duration: "41m", "1h 5m", "<1m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '<1m'
  const hours = Math.floor(minutes / 60)
  return hours === 0 ? `${String(minutes)}m` : `${String(hours)}h ${String(minutes % 60)}m`
}
