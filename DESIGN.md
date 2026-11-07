# cost-lens: design

## Summary

cost-lens is a Claude Code mod that helps a person spend less on Claude Code. It shows where tokens and dollars go (by cost category, model, project and branch), warns before a message would rebuild a cold prompt cache, and suggests a cheaper model when a prompt sent to Opus or Fable looks routine. It is the terminal-native counterpart of the VS Code "Claude Code Usage" extension, built on the Claude Code mod API (function hooks, Claude Code 2.1.319).

## Problem

Claude Code bills every message for the whole context it re-sends, so cost grows with session length and depends heavily on the prompt cache and the model. Two things drive most of the avoidable cost:

1. **Stale cache.** Every message re-sends the whole context. While the prompt cache is warm, that context is billed as a cache read (0.025x input on Fable 5.1, 0.05x on Opus 5.5). After the cache's time-to-live (5 minutes or 1 hour; this machine's sessions write 1-hour entries) the next message re-writes the whole context at 1.25x or 2x input. One message after a long pause on a 180k-token Fable session costs about $3.60 in cache writes alone.
2. **Model choice.** Routine prompts sent to Opus or Fable cost 2x to 5x what Sonnet would.

## Users and entry points

The person at a Claude Code terminal session. Every feature is reached from one of these entry points:

| Entry point                        | What it does                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/cost-lens` slash command         | Opens the cost-lens pane beside the chat.                                                                                                                                                                                                                                                                            |
| Pane with tabs                     | **Now** (this session), **Today**, **30 days**, **All time**, **Projects**, **Tips**. A tab row of buttons switches the view; a Refresh button re-reads the logs.                                                                                                                                                    |
| Band above the prompt              | One line: model, context size, cache status (`warm, 41m left` or `cold, next message re-writes 84k tokens ~$1.68`), session cost so far.                                                                                                                                                                             |
| Prompt submit (cold-cache warning) | When the cache has expired and the context is large, shows a warning toast as the prompt goes out: how many tokens it re-writes and roughly what that costs, with `/compact` and `/clear` as the alternatives next time. It never holds, delays or drops the prompt. The band shows the same warning before sending. |
| Prompt submit (model advisor)      | After a prompt is sent on an Opus or Fable model, a Haiku classification runs; when it judges the prompt routine, a toast suggests `/model sonnet`, at most once per 10 minutes. It never blocks or delays the prompt.                                                                                               |

## Components

### Core (pure TypeScript, no I/O)

- Price table: dollars per million tokens for base input, 5-minute cache writes, 1-hour cache writes, cache reads and output, per model id, copied from Anthropic's pricing page (decision 0006). Haiku 5.5 has a second row for prompts over 100,000 tokens. Two modifiers the logs record per request: `speed: "fast"` uses the fast-mode rates (Opus 5.5: $8 / $40), and `inference_geo: "us"` multiplies every category by 1.1. Unknown models are reported as unpriced, never guessed.
- Cost math: a usage record (input, output, cache-write 5m, cache-write 1h, cache-read tokens, model) to a cost split by category.
- Aggregation: records into totals by period, model, project and branch.
- Cold-rebuild detection: within one session file, a request whose gap since the previous request exceeds the previous entry's time-to-live, that writes at least 5,000 cache tokens and reads fewer than it writes. Its wasted cost is what the writes cost minus what reading the same tokens would have cost.
- Formatting helpers shared by the pane and the band (dollars, token counts, durations).

### Analyzer (Node CLI)

- Reads every `~/.claude/projects/**/*.jsonl` session log. Only assistant entries with `message.usage` count; entries repeat per content block, so records are de-duplicated by `message.id`. `<synthetic>` models are skipped.
- Keeps an incremental index at `~/Library/Caches/cost-lens/` keyed by file path, size and modification time, so only changed logs are re-read (the logs are about 1.1 GB across about 2,000 files).
- Prints one JSON document to stdout: periods (today, 30 days, all time) with totals, cost split, cache hit rate, cold rebuilds and the share of cost above 150k context; breakdowns by model, project and branch; and the time-to-live the most recent request used.
- Runs with `node`, which runs TypeScript directly (Node 26). The mod starts it with `$.process.run`.

### Mod (Claude Code hooks module)

- `hooks/register.tsx` is the only entry the engine loads; it wires hooks from `src/mod/`.
- Live tracking: a `turn.step` hook reads each request's usage and model; the main loop's last request time and context size drive the band and the cold-cache warning.
- `$.session.usage()` supplies the session's exact cost and context window; `breakdown: 'summary'` (a local estimate, no API calls) supplies the context categories for the Now tab.
- Pane, band and toasts use the engine's element tables (`$.ui.resolve`). State a drawing reads lives in `$.state`, declared in `types/index.d.ts`.

## Module boundaries

| Module          | May import                       | Must not import                           |
| --------------- | -------------------------------- | ----------------------------------------- |
| `src/core/`     | `src/core/` only                 | anything else, Node built-ins, packages   |
| `src/analyzer/` | `src/core/`, Node built-ins      | `src/mod/`, `hooks/`, packages            |
| `src/mod/`      | `src/core/`, `claude-code` types | `src/analyzer/`, Node built-ins, packages |
| `hooks/`        | `src/mod/`, `claude-code` types  | `src/analyzer/`, Node built-ins, packages |
| `tools/`        | Node built-ins                   | `src/`, `hooks/`                          |
| `tests/`        | anything                         |                                           |

The mod runs in the engine's sandbox (no DOM, no Node, no npm packages); the analyzer runs under Node. Shared logic lives in `src/core/` so both can use it.

## Data and privacy

Everything stays on the machine. The analyzer reads local logs and writes a local index. The only network use is the model advisor's Haiku classification, which sends the prompt text to Anthropic through Claude Code's own model access, the same place the prompt itself goes.

## Installation

The repository root is the plugin root. The owner loads it in every session through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (then `chezmoi re-add`). Sharing with other people (a marketplace file and `/plugin install`) is out of scope until the owner asks.

## Non-goals

- Enforcing model or spend limits (that belongs in admin settings).
- Usage from claude.ai, other machines or other tools.
- The VS Code extension's per-content-category analysis of historical sessions (tool results versus prompts); the Now tab shows the live session's categories instead.
- Achievements, workflow tables, Codex usage.
