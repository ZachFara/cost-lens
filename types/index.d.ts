// The mod's state contract. It must be self-contained (no imports), so the summary's
// shape is spelled out here; the mod assigns src/core/summary.ts's Summary to it and
// back, so the compiler keeps the two identical.

/** The pane's tabs, in the order the tab row shows them. */
export type Tab = 'now' | 'today' | 'last30' | 'all' | 'projects' | 'branches' | 'prs' | 'tips'

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

export interface SummaryModel {
  model: string
  requests: number
  isPriced: boolean
  tokens: SummaryTotals['tokens']
  cost: SummaryTotals['cost']
}

export interface SummarySpend {
  requests: number
  cost: SummaryTotals['cost']
  lastActive: string
}

/** The analyzer's last run, as the pane shows it. */
export type History =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready'
      summary: {
        generatedAt: string
        pricesFetched: string
        today: SummaryTotals
        last30: SummaryTotals
        allTime: SummaryTotals
        byModel: { today: SummaryModel[]; last30: SummaryModel[]; allTime: SummaryModel[] }
        projects: { path: string; last30: SummarySpend }[]
        currentProject: { path: string; branches: { branch: string; spend: SummarySpend }[] } | null
        cacheLifetimeMs: number
        tips: {
          last30: {
            cost: number
            coldRebuilds: number
            coldWaste: number
            largeContextCost: number
          }
          last24h: {
            cost: number
            largeContextCost: number
            skills: { name: string; cost: number }[]
            mcpServers: { name: string; cost: number }[]
          }
        }
      }
      /** A refresh is running; the summary above stays on screen meanwhile. */
      isRefreshing: boolean
      /** Why the last refresh failed, or null; the summary is the last good one. */
      refreshError: string | null
    }
  | { status: 'error'; message: string }

/** The main conversation's latest request: when, on which model, with how big a prompt. */
export interface LastRequest {
  at: number
  model: string
  promptTokens: number
}

/** The last `gh pr list` in the session's repository. */
export type PullRequests =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; prs: { number: number; title: string; state: string; branch: string }[] }
  | { status: 'error'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'cost-lens': {
      tab: Tab
      history: Shaped<History>
      pullRequests: Shaped<PullRequests>
      /** This session's requests so far, as each response completes. */
      live: Shaped<SummaryTotals>
      lastRequest: Shaped<LastRequest | null>
      isBandHidden: boolean
      minute: number
      /** When the model advisor last suggested a cheaper model (ms since the epoch). */
      lastAdviceAt: number
    }
  }
}
