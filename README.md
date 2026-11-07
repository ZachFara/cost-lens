# cost-lens

A Claude Code mod that shows where your Claude Code tokens and dollars go, warns before a message rebuilds a cold prompt cache, and suggests a cheaper model for routine prompts.

Status: repository setup. See `PROGRESS.md` for what is built and what is next, and `DESIGN.md` for the plan.

## Install

Requires Claude Code 2.1.319 or later, Node.js 22.18 or later on your `PATH`, and, for the PRs tab, the GitHub CLI (`gh`). Built and tested on macOS.

At the prompt of a Claude Code terminal session:

```
/plugin install cost-lens --marketplace ZachFara/cost-lens
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). From a shell instead:

```sh
claude plugin install cost-lens --marketplace ZachFara/cost-lens
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `ZachFara/cost-lens`, then Add plugin.

Then type `/cost-lens` to open the pane. In Claude Code's fullscreen layout (`/tui fullscreen`) it docks beside the chat; otherwise it opens above the prompt.

## What it shows

- **Now**: your plan's usage limits (as `/usage` shows them), this session's model, cost, cost split and context.
- **Today**, **30 days**, **All time**: total cost, cache hit rate, cost by category and by model.
- **Projects**, **Branches**, **PRs**: where the last 30 days went, and what each branch and pull request of the current repository cost.
- **Tips**: what drives your usage in the last 24 hours, and the cost of expired-cache rebuilds and large context in the last 30 days.
- A line above the prompt with the prompt cache's state, a warning when a message re-writes an expired cache, and a suggestion when a routine prompt goes to Opus or Fable.

Costs are estimates from the session logs Claude Code keeps on your machine (`~/.claude/projects`), priced with Anthropic's published prices. Nothing leaves your machine except the pricing page download and the model advisor's short classification request.

## Load from a working copy instead

Point Claude Code at this folder in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/path/to/cost-lens" } }
```

Every new session then loads the mod; type `/cost-lens` to open the pane.

## Develop

```sh
npm install        # also installs the git hooks
claude --plugin-dir .   # once, so Claude Code writes its mod API types
npm run engine-types    # copy them into vendor/ (gitignored)
npm run check      # everything CI runs
claude --plugin-dir .   # try the mod in a session
```

Agents: start with `AGENTS.md`.

## License

MIT. See `LICENSE`.
