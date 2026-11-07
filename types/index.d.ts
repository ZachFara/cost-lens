/** The pane's tabs, in the order the tab row shows them. */
export type Tab = 'now' | 'today' | 'last30' | 'all' | 'projects' | 'tips'

declare module 'claude-code' {
  interface PluginState {
    'cost-lens': { tab: Tab }
  }
}
