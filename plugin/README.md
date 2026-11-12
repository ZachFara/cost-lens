# cost-lens

A Claude Code mod that shows where your Claude Code tokens and dollars go. `/cost-lens` opens a pane with your plan's usage limits, this session's cost and context, totals by day, model, project, branch and pull request, and tips on what drives your usage. A line above the prompt counts down the prompt cache and warns when a message will re-write an expired one. Source, screenshots and docs: https://github.com/ZachFara/cost-lens

Requires Claude Code 2.1.319 or later, Node.js 22.18 or later on your `PATH`, and the GitHub CLI (`gh`) for the PRs tab. Tested on macOS.

## What it runs

- `nice -n 10 node <this plugin>/src/analyzer/cli.ts --live-prices [--project <repository folder>]`: the plugin's own log reader, at low CPU priority. It runs when you open a data tab, when you press Refresh, and every five minutes while the pane is shown. It reads Claude Code's session logs and prints a JSON summary for the pane.
- `gh pr list --state all --limit 100 --json number,title,state,headRefName`, in the session's repository, when you open the PRs tab or press Refresh there. It runs with your own GitHub CLI login; cost-lens never reads or stores that credential.
- The plugin also holds a terminal view, `<this plugin>/src/terminal/cli.ts`, that you can start yourself with `node` in any terminal, outside Claude Code. No hook starts it. It runs the same log reader and `gh pr list` (in the folder it starts in), plus `git rev-parse --show-toplevel` to find that folder's repository, reads and sends nothing else, and draws only in that terminal.

## What it reads

- Claude Code's session logs in `~/.claude/projects`: each response's token usage, model, time, working folder and git branch, and the names of the skills and MCP servers it called. It does not read message text for the summary.
- From Claude Code: this session's usage, cost, model, context breakdown and plan limits; the repository the session runs in; each model request's token usage once its response is complete.
- The text of a prompt you type, only when LLM features are on (see below).

## What it sends, and where

- Once a day, an HTTPS request for Anthropic's pricing page (`https://platform.claude.com/docs/en/about-claude/pricing.md`), cached in `~/Library/Caches/cost-lens/prices.json`. Nothing about you is sent.
- With "Allow LLM features" on (off by default): the text of each prompt you type that is 40 characters or longer goes to Anthropic's Haiku model, through Claude Code's own model access, to pick the model that fits it. Only the chosen tier, the model names and the time are kept.
- `gh pr list` (above) talks to GitHub.

Nothing else leaves your machine.

## Hooks

- `session.start`: registers `/cost-lens` and starts two timers (the five-minute refresh while the pane is shown, and a one-minute redraw of the cache line).
- `command.run` on `/cost-lens`: opens the pane; `/cost-lens band` shows the cache line again after you hid it. It answers only its own command.
- `ui.render`: draws the pane and the line above the prompt.
- `turn.step`: reads each model request's token usage after its response arrives. It never changes a request or a response.
- `session.measure`: keeps the last reading of each plan usage window, so the Now tab can still show one that a later response stops reporting. It only observes.
- `prompt.submit`: for a prompt you type, may show a cold-cache warning and, with LLM features on, a model suggestion. It never holds, changes or delays the prompt.

## Settings

In `/config`, under cost-lens: "Allow LLM features" (off by default) and "Model recommendation notifications" (on by default; needs LLM features).

## License

MIT
