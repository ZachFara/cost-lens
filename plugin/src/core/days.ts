const DAY_MS = 24 * 60 * 60 * 1000

/** The local calendar day of a moment, as YYYY-MM-DD. */
export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Whole calendar days from `day` to `today` (both YYYY-MM-DD): 0 for the same day. */
export function daysBefore(day: string, today: string): number {
  return Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS)
}
