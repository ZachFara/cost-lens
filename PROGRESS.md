# PROGRESS

## Status

Phase 2 in progress. Tasks 1 to 4 are done; task 4b (pane look) is done; task 5 is next.

## Tasks

Small tasks, one session each, in dependency order. Each starts at a user-facing entry point (see AGENTS.md, CODE).

1. **(done)** **`/cost-lens` opens an empty pane with its tab row.** Entry: slash command. Done when: the command opens a pane titled cost-lens showing the tabs Now, Today, 30 days, All time, Projects, Tips; pressing a tab marks it selected; engine test covers both on terminal and desktop.
2. **(done)** **Install cost-lens for the owner.** Entry: every new Claude Code session. Done when: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` names this folder, `chezmoi re-add` has run, and a new session lists `/cost-lens`. Depends on 1.
3. **(done)** **All time tab shows total cost and cost split.** Entry: All time tab. Done when: the pane runs the analyzer through `$.process.run`, shows a loading line, then total cost, request count, cache hit rate and the split (input, output, cache write, cache read) as numbers and a bar; core pricing and cost math tested with node:test; analyzer tested against fixture logs in a temporary folder; engine test with the process call answered by the test.
4. **(done)** **Refresh, in the background too.** Entry: Refresh button. Done when: Refresh re-reads the logs while the last numbers stay on screen; every five minutes the numbers refresh on their own while the pane is shown and already loaded; reads run at low CPU priority (`nice -n 10`), one at a time; a failed refresh keeps the last numbers and says why. (Replaces the incremental index, owner's decision: a full read takes about 3 seconds.)
   4b. **(done)** **The pane matches the terminal.** Entry: the pane. Done when: the pane draws no background of its own (the terminal theme shows through, like the chat), and the four cost categories use clearly different colors.
5. **Today and 30 days tabs.** Entry: those tabs. Done when: periods use local dates; tests cover the day boundary.
6. **Per-model breakdown in period tabs.** Entry: period tabs. Done when: each period lists models by cost with tokens and cache hit rate; unpriced models are labelled, not guessed.
7. **Projects tab.** Entry: Projects tab. Done when: the 30-day cost by project and git branch is listed, top 15, with last active time.
8. **Now tab: live session.** Entry: Now tab. Done when: a `turn.step` hook records each request's usage; the tab shows model, context used of window, session cost from `$.session.usage()`, this session's cost split and the context categories from `breakdown: 'summary'`.
9. **Cache band above the prompt.** Entry: the band. Done when: it shows `warm, Nm left` or `cold, next message re-writes Nk tokens ~$X`, refreshes on a timer, uses the time-to-live the analyzer reports (default one hour), and can be hidden.
10. **Cold-cache warning.** Entry: prompt submit. Done when: a prompt sent while the cache is cold and the context is at least 40k tokens raises a warning toast with the tokens it re-writes and the estimated cost; the prompt is never held, delayed or changed; slash commands and non-composer prompts raise nothing; a failing hook still lets the prompt through.
11. **Cold rebuilds and Tips tab.** Entry: Tips tab. Done when: the analyzer reports cold rebuilds and their wasted cost and the share of cost above 150k context; the Tips tab turns them into plain advice; detection tested on fixture logs.
12. **Model advisor.** Entry: prompt submit on Opus or Fable. Done when: after the prompt enters, a Haiku classification judges it; routine prompts get one toast suggesting `/model sonnet`, at most every 10 minutes; the prompt is never delayed.
13. **Live price table.** Entry: Refresh button. Done when: the analyzer fetches Anthropic's pricing page as markdown (decision 0006) at most once a day, parses the model table into the core price table, caches it, and falls back to the built-in snapshot when offline or when the page cannot be parsed; the pane says which prices it used and when they were fetched; parsing tested on a saved copy of the page.

## Open Questions

None.

## Next steps

- Task 5: Today and 30 days tabs.
- Small cleanup (separate chore branch): knip reports `vendor/**` in `knip.json` `ignore` as unnecessary, because `vendor/` is outside the project patterns; remove it.

## Learned

- Claude Code session logs repeat an assistant entry once per content block with the same `message.id` and usage; de-duplicate by `message.id`.
- This machine's sessions write 1-hour cache entries (`usage.cache_creation.ephemeral_1h_input_tokens`).
- Decided in review: the repository is public; personal spend figures and organization details stay out of it; the engine's generated API types are not committed (decision 0004).
- Installed 2026-11-07: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (saved with `chezmoi re-add`); a fresh `claude -p "/cost-lens"` with no flags loads the mod.
- The analyzer reads the owner's full logs in about 3 seconds (2026-11-07), and its totals land within about 5% of the VS Code usage extension's, by category as well as overall.
- Answered in review (2026-11-07): MIT license; the narrowed lint rule is approved; prices come from Anthropic's pricing page (decision 0006), with a live price table as task 13; the model advisor may send prompt text to Haiku; the cold-cache check only warns and never stops a prompt.
- `claude plugin validate .` reports more than 4096 files because `node_modules/` sits inside the plugin folder. Installed in task 2; not yet seen in an interactive session whether watching that folder slows hot reload. If it does, raise it here.
