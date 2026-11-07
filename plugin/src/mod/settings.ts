import type { PluginOptions } from 'claude-code'

/** The person's cost-lens settings (`userConfig` in plugin.json, shown in /config). */
export interface Settings {
  /** A small model may read the text of typed prompts (the model recommendation). */
  llmFeatures: boolean
  /** Toast when the recommended model differs from the one in use. */
  recommendationAlerts: boolean
}

/** Reads the engine's options; anything not exactly `true` or `false` takes the default. */
export function readSettings(options: PluginOptions): Settings {
  return {
    llmFeatures: options.llmFeatures === true,
    recommendationAlerts: options.recommendationAlerts !== false,
  }
}
