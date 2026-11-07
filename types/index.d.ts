// The mod's state contract. It must be self-contained (no imports), so the summary's
// shape is spelled out here; the mod assigns src/core/summary.ts's Summary to it and
// back, so the compiler keeps the two identical.

/** The pane's tabs, in the order the tab row shows them. */
export type Tab = 'now' | 'today' | 'last30' | 'all' | 'projects' | 'tips'

export interface SummaryTotals {
  requests: number
  unpricedRequests: number
  unpricedModels: string[]
  tokens: {
    input: number
    output: number
    cacheWrite5m: number
    cacheWrite1h: number
    cacheRead: number
  }
  cost: { input: number; output: number; cacheWrite: number; cacheRead: number }
}

/** The analyzer's last run, as the pane shows it. */
export type History =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready'
      summary: { generatedAt: string; pricesFetched: string; allTime: SummaryTotals }
    }
  | { status: 'error'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'cost-lens': { tab: Tab; history: Shaped<History> }
  }
}
