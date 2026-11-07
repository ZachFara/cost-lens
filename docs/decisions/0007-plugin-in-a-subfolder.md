# 0007. The plugin lives in a subfolder

Date: 2026-11-07. Status: accepted. Supersedes 0005.

## Context

Anthropic's plugin directory installs and scans everything in the plugin folder. With the repository root as the plugin root (decision 0005), its validation held the listing for `package.json` and the lockfile (it treats them as dependencies to install), for development config files outside its allowed types, and for README images, none of which the mod needs.

## Decision

- The plugin is `plugin/`: its manifest and icon, `hooks/`, `src/`, `types/`, the engine tests (`claude plugin test` runs the tests under the folder it loads) and a `README.md` that says what the mod runs, reads and sends.
- Development tooling, docs, decision records, Node tests and README media stay at the repository root.
- `.claude-plugin/marketplace.json` at the root lists the plugin with `"source": "./plugin"`, so the install line is unchanged.
- The owner's sessions load `~/Development/active/cost-lens/plugin` through `CLAUDE_CODE_PLUGIN_DIRS`.

## Consequences

- The directory installs only what the mod runs.
- Paths in configs, tools and docs carry the `plugin/` prefix; the layout check and dependency rules enforce it.
- The engine writes `plugin/.claude-plugin/types/` and, with no tsconfig of the plugin's own, `plugin/tsconfig.json`; both are gitignored.
