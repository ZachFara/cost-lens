# 0008. A terminal view outside Claude Code

Date: 2026-11-11. Status: accepted.

## Context

The owner asked for cost-lens to run in a plain terminal tab, the way btop or top runs, without a Claude Code session (MIT-677). The pane cannot do that: it is drawn by the engine, and Claude Code has no way to show a mod's pane outside a session. Its views (`plugin/src/mod/*-view.tsx`) are JSX for the engine's elements; Node runs TypeScript but not JSX, and outside the engine there are no elements to draw.

## Decision

- A Node program, `plugin/src/terminal/cli.ts`, shows the pane's data tabs (Today, 30 days, All time, Projects, Branches, PRs, Tips) full screen, using the alternate screen buffer and raw keys: 1 to 7 and ←/→ switch tabs, ↑/↓, space and page keys scroll, r refreshes, q quits. With its output piped or redirected, it prints every tab once as plain text.
- It gets its numbers the way the mod does: it runs the analyzer as a program (`nice -n 10 node src/analyzer/cli.ts --live-prices --project <folder>`), refreshes every five minutes, and lists pull requests with `gh pr list` in the repository it was started in.
- It draws its own lines of styled text (`plugin/src/terminal/`), from the same `plugin/src/core/` formatting and data as the pane, in the terminal's 16 theme colors. It does not import the mod's views.
- Now and Model are left out: plan limits, the context window and per-prompt recommendations exist only inside a Claude Code session.
- `plugin/src/terminal/` may import `plugin/src/core/` and Node built-ins only (dependency-cruiser); the mod and the analyzer never import it.
- It ships inside the plugin folder, so an installed copy can run it. People start it themselves; no hook starts it.

## Consequences

- A change to a pane tab's content has a second place to land: the matching function in `plugin/src/terminal/views.ts` or `tips-lines.ts`. The core holds the numbers and formatting, so what is repeated is layout only.
- There is no package to install: installed users run it with Node from the plugin's cache folder (the README gives a shell alias), and the owner runs it from the working copy.
- Characters are counted as one cell each; an East Asian wide character or an emoji in a project or PR title can push that line one cell past the edge, where the terminal cuts it.
