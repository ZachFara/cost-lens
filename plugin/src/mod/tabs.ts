import type { Period } from '../core/summary.ts'
import type { Tab } from '../../types'

export const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'model', label: 'Model' },
  { id: 'today', label: 'Today' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'projects', label: 'Projects' },
  { id: 'branches', label: 'Branches' },
  { id: 'prs', label: 'PRs' },
  { id: 'tips', label: 'Tips' },
]

/** The tabs that show a period of the analyzer's summary. */
export const PERIOD_OF: Partial<Record<Tab, Period>> = {
  today: 'today',
  last30: 'last30',
  all: 'allTime',
}

/** The tabs that draw the analyzer's summary; opening one starts the first read. */
export const DATA_TABS: ReadonlySet<Tab> = new Set([
  'today',
  'last30',
  'all',
  'projects',
  'branches',
  'prs',
  'tips',
])
