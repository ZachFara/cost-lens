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
