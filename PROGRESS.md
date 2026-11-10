# PROGRESS

## Status

Phase 2 in progress. Tasks 1 to 4 are done; tasks 4b (pane look), 5 (Today, 30 days) 6 (per model), 7 (Projects), 7b (Branches), 7c (PRs), 8 (Now), 9 (cache line), 10 (cold-cache warning), 11 (Tips), 12 (model advisor) and 13 (live prices) are done. Tasks 14 (marketplace), 15 (context grid) and 16 (model recommendation) and 17 (Model tab and settings) are done, launch prep (18) is done, and publishing (19) is done apart from Show HN.

## Tasks

Small tasks, one session each, in dependency order. Each starts at a user-facing entry point (see AGENTS.md, CODE).

1. **(done)** **`/cost-lens` opens an empty pane with its tab row.** Entry: slash command. Done when: the command opens a pane titled cost-lens showing the tabs Now, Today, 30 days, All time, Projects, Tips; pressing a tab marks it selected; engine test covers both on terminal and desktop.
2. **(done)** **Install cost-lens for the owner.** Entry: every new Claude Code session. Done when: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` names this folder, `chezmoi re-add` has run, and a new session lists `/cost-lens`. Depends on 1.
3. **(done)** **All time tab shows total cost and cost split.** Entry: All time tab. Done when: the pane runs the analyzer through `$.process.run`, shows a loading line, then total cost, request count, cache hit rate and the split (input, output, cache write, cache read) as numbers and a bar; core pricing and cost math tested with node:test; analyzer tested against fixture logs in a temporary folder; engine test with the process call answered by the test.
4. **(done)** **Refresh, in the background too.** Entry: Refresh button. Done when: Refresh re-reads the logs while the last numbers stay on screen; every five minutes the numbers refresh on their own while the pane is shown and already loaded; reads run at low CPU priority (`nice -n 10`), one at a time; a failed refresh keeps the last numbers and says why. (Replaces the incremental index, owner's decision: a full read takes about 3 seconds.)
   4b. **(done)** **The pane matches the terminal.** Entry: the pane. Done when: the pane draws no background of its own (the terminal theme shows through, like the chat), and the four cost categories use clearly different colors.
5. **(done)** **Today and 30 days tabs.** Entry: those tabs. Done when: periods use local dates; tests cover the day boundary.
6. **(done)** **Per-model breakdown in period tabs.** Entry: period tabs. Done when: each period lists models by cost with tokens and cache hit rate; unpriced models are labelled, not guessed.
7. **(done)** **Projects tab.** Entry: Projects tab. Done when: the 30-day cost by project and git branch is listed, top 15, with last active time.
   7b. **(done)** **Branches tab (current project).** Entry: Branches tab. Done when: for the git repository the session runs in, the tab lists each branch Claude Code worked on with its cost, requests and last active time, most expensive first; sessions outside a repository say so. (Owner request, 2026-11-07.)
   7c. **(done)** **PRs tab (current project).** Entry: PRs tab. Done when: the tab lists the repository's pull requests (from `gh`), each with the cost of the work on its head branch, state and title; without `gh` or a GitHub remote it says why. (Owner request, 2026-11-07.)
8. **(done)** **Now tab: live session.** Entry: Now tab. Done when: a `turn.step` hook records each request's usage; the tab shows model, context used of window, session cost from `$.session.usage()`, this session's cost split and the context categories from `breakdown: 'summary'`. Also at the top: the plan's usage limits from `$.session.usage().rateLimits` (current session, current week for all models, and any per-model week), each with a bar, percent used and reset time, as `/usage` shows them. (Owner request, 2026-11-07.)
9. **(done)** **Cache band above the prompt.** Entry: the band. Done when: it shows `warm, Nm left` or `cold, next message re-writes Nk tokens ~$X`, refreshes on a timer, uses the time-to-live the analyzer reports (default one hour), and can be hidden.
10. **(done)** **Cold-cache warning.** Entry: prompt submit. Done when: a prompt sent while the cache is cold and the context is at least 40k tokens raises a warning toast with the tokens it re-writes and the estimated cost; the prompt is never held, delayed or changed; slash commands and non-composer prompts raise nothing; a failing hook still lets the prompt through.
11. **(done)** **Cold rebuilds and Tips tab.** Entry: Tips tab. Done when: the analyzer reports cold rebuilds and their wasted cost and the share of cost above 150k context; the Tips tab turns them into plain advice; detection tested on fixture logs. Also, as `/usage` shows it, for the last 24 hours: what is contributing to usage (share at large context, so `/clear` when switching tasks; MCP servers' tool definitions per request; computer use), and the share of usage by skill and by MCP server, each labelled approximate. (Owner request, 2026-11-07.)
12. **(done)** **Model advisor.** Entry: prompt submit on Opus or Fable. Done when: after the prompt enters, a Haiku classification judges it; routine prompts get one toast suggesting `/model sonnet`, at most every 10 minutes; the prompt is never delayed.
13. **(done)** **Live price table.** Entry: Refresh button. Done when: the analyzer fetches Anthropic's pricing page as markdown (decision 0006) at most once a day, parses the model table into the core price table, caches it, and falls back to the built-in snapshot when offline or when the page cannot be parsed; the pane says which prices it used and when they were fetched; parsing tested on a saved copy of the page.

14. **(done)** **Marketplace file.** Entry: `/plugin install cost-lens --marketplace ZachFara/cost-lens`. Done when: `.claude-plugin/marketplace.json` lists the plugin, the README has the install lines and requirements, and a fresh install from GitHub in a throwaway home loads the mod. (Owner request, 2026-11-07.)
15. **(done)** **Context grid in the Now tab.** Entry: Now tab. Done when: the context window is drawn as a grid of colored squares, filled by category as `/context` draws it (`$.session.usage({ breakdown: 'summary', columns })`'s grid), with a legend; it fits the pane's width. (Owner request, 2026-11-07.)
16. **(done)** **Model recommendation.** Entry: prompt submit and the Now tab. Done when: each substantive prompt is judged into a tier (Haiku: trivial lookups and formatting; Sonnet: routine coding; Opus: complex reasoning or multi-file work; Fable: the hardest, long-running work); the Now tab shows the recommendation for the last prompt beside the current model; a toast suggests switching when the recommendation differs from the current model, in either direction, at most every ten minutes. Replaces task 12's Sonnet-only advice. (Owner request, 2026-11-07.)

17. **(done)** **Model tab and settings.** Entry: Model tab and `/config`. Done when: the recommendation lives in its own Model tab (latest card, recent recommendations without prompt text, how prompts are judged, the settings' state), no longer in Now; `userConfig` declares "Allow LLM features" (off by default; nothing is sent to a model while off) and "Model recommendation notifications" (on); the owner's own setting is on. (Owner request, 2026-11-07.)

18. **(done)** **Launch prep.** Tab hotkeys 1 to 9 (PR #24); the full-size context grid in docked panes (PR #25); listing icon, screenshots and tab tour GIF with project names irreversibly blurred, README Screenshots section, `claude plugin validate --profile directory .` passing (PR #26). (Owner request, 2026-11-07.)
19. **(mostly done)** **Publish.** Released `cost-lens--v0.1.0` (GitHub release). Opened hamzafer/claude-code-mods#173 and whyashthakker/awesome-claude-code-mods#29 (waiting on their maintainers). Submitted to Anthropic's plugin directory on 2026-11-07 (path `plugin`, branch `main`, auto-publish off, scheduled checks; held for policy review for the 5 holds `plugin/README.md` answers); the first version is published from the portal (claude.ai/directory/manage) once approved. Show HN was refused: Hacker News restricts Show HN for new accounts; post later from an account with history. Reddit skipped at the owner's request.

20. **(done)** **Plan windows after a reset (MIT-583).** Entry: Now tab. Done when: on a subscription, Current session and Current week always show, at 0% with an empty bar when Claude Code does not report them; any window past its reset time shows 0% until the next reading; an open Now tab redraws each minute so a reset shows without reopening. (Owner report, 2026-11-10.)

## Open Questions

None.

## Next steps

- Task 19 (publish), with the owner. Other candidates: skill shares closer to `/usage` (count a skill's text in later requests); let the mod's own estimates (cache line, advisor, Now split) use the live prices too (today they use the built-in snapshot).
- Possible follow-up (not scheduled): a per-model week (for example Current week (Fable)) that Claude Code stops reporting still disappears from the Now tab. Keeping it needs an atom and a `session.measure` hook in `plugin/hooks/register.tsx`, which is at the 300-line lint limit; that needs room made first (MIT-583).
- Possible follow-up (not scheduled): skill shares count only the request that invoked a skill, so they read lower than `/usage`, which appears to count the skill's text in later requests too.
- Small cleanup (separate chore branch): knip reports `vendor/**` in `knip.json` `ignore` as unnecessary, because `vendor/` is outside the project patterns; remove it.

## Learned

- `$.session.usage().rateLimits` holds only the windows the last API response reported: after the five-hour window resets, Claude Code can stop reporting it, so the Now tab always shows the session and week windows and shows a missing or reset one at 0% (MIT-583).
- Claude Code session logs repeat an assistant entry once per content block with the same `message.id` and usage; de-duplicate by `message.id`.
- This machine's sessions write 1-hour cache entries (`usage.cache_creation.ephemeral_1h_input_tokens`).
- Decided in review: the repository is public; personal spend figures and organization details stay out of it; the engine's generated API types are not committed (decision 0004).
- Folders reach the logs both as `~/Development/...` and as `~/Ark/Development/...` (a link); the analyzer resolves links before matching a project.
- The engine reports a request's cache writes without their lifetime (`turn.step` usage); the Now tab prices them as one-hour writes, which this machine's sessions use, and takes the session total from `$.session.usage()` (exact, as `/cost`).
- Owner's settings (2026-11-07): `pluginConfigs.cost-lens.options.llmFeatures = true` in `~/.claude/settings.json`, saved with `chezmoi re-add`; the owner also switched to `/tui fullscreen`.
- Launch media recipe: run Claude Code in a detached tmux session (`tmux new-session -d -s <name> -x 200 -y 56 -e COLORTERM=truecolor claude`), drive it with `tmux send-keys`, capture frames with `tmux capture-pane -e -p`, turn the ANSI into HTML (private text replaced, then blurred) and screenshot it with headless Chrome in its own `--user-data-dir`; ffmpeg makes the GIF. `ctrl+x tab` gives the keyboard to the cache line first and to the pane on the second press.
- The plugin directory (claude.ai/directory/manage) validates stricter than `claude plugin validate`: `$` and `on` only in the hooks module, commands written as literals, no `package.json` or dev files in the plugin folder, and README disclosures for every program, read and send. Plugins with mods may later be accepted only from Verified organizations.
- Installed 2026-11-07: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (saved with `chezmoi re-add`); a fresh `claude -p "/cost-lens"` with no flags loads the mod.
- The analyzer reads the owner's full logs in about 3 seconds (2026-11-07), and its totals land within about 5% of the VS Code usage extension's, by category as well as overall.
- Answered in review (2026-11-07): MIT license; the narrowed lint rule is approved; prices come from Anthropic's pricing page (decision 0006), with a live price table as task 13; the model advisor may send prompt text to Haiku; the cold-cache check only warns and never stops a prompt.
- `claude plugin validate .` reports more than 4096 files because `node_modules/` sits inside the plugin folder. Installed in task 2; not yet seen in an interactive session whether watching that folder slows hot reload. If it does, raise it here.
