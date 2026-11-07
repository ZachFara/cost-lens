# PROGRESS

## Status

Phase 1 (repository setup) is in review on `chore/setup`. No feature code yet. Phase 2 starts when the owner approves.

## Tasks

Small tasks, one session each, in dependency order. Each starts at a user-facing entry point (see AGENTS.md, CODE).

1. **`/cost-lens` opens an empty pane with its tab row.** Entry: slash command. Done when: the command opens a pane titled cost-lens showing the tabs Now, Today, 30 days, All time, Projects, Tips; pressing a tab marks it selected; engine test covers both on terminal and desktop.
2. **Install cost-lens for the owner.** Entry: every new Claude Code session. Done when: `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` names this folder, `chezmoi re-add` has run, and a new session lists `/cost-lens`. Depends on 1.
3. **All time tab shows total cost and cost split.** Entry: All time tab. Done when: the pane runs the analyzer through `$.process.run`, shows a loading line, then total cost, request count, cache hit rate and the split (input, output, cache write, cache read) as numbers and a bar; core pricing and cost math tested with node:test; analyzer tested against fixture logs in a temporary folder; engine test with the process call answered by the test.
4. **Incremental index.** Entry: Refresh button. Done when: a second run reads only changed logs; measured first and second run times on the owner's machine are recorded in a decision record; tests cover changed, unchanged and deleted files.
5. **Today and 30 days tabs.** Entry: those tabs. Done when: periods use local dates; tests cover the day boundary.
6. **Per-model breakdown in period tabs.** Entry: period tabs. Done when: each period lists models by cost with tokens and cache hit rate; unpriced models are labelled, not guessed.
7. **Projects tab.** Entry: Projects tab. Done when: the 30-day cost by project and git branch is listed, top 15, with last active time.
8. **Now tab: live session.** Entry: Now tab. Done when: a `turn.step` hook records each request's usage; the tab shows model, context used of window, session cost from `$.session.usage()`, this session's cost split and the context categories from `breakdown: 'summary'`.
9. **Cache band above the prompt.** Entry: the band. Done when: it shows `warm, Nm left` or `cold, next message re-writes Nk tokens ~$X`, refreshes on a timer, uses the time-to-live the analyzer reports (default one hour), and can be hidden.
10. **Cold-cache guard.** Entry: prompt submit. Done when: a prompt sent while the cache is cold and the context is at least 40k tokens asks first; cancel drops the prompt and puts its text back in the prompt box; slash commands and non-composer prompts pass untouched; a failing guard lets the prompt through.
11. **Cold rebuilds and Tips tab.** Entry: Tips tab. Done when: the analyzer reports cold rebuilds and their wasted cost and the share of cost above 150k context; the Tips tab turns them into plain advice; detection tested on fixture logs.
12. **Model advisor.** Entry: prompt submit on Opus or Fable. Done when: after the prompt enters, a Haiku classification judges it; routine prompts get one toast suggesting `/model sonnet`, at most every 10 minutes; the prompt is never delayed.

## Open Questions

1. **GitHub visibility and branch protection.** Branch protection and required checks are not available on private repositories on GitHub's free plan. Public, or private with a paid plan? (Asked in the Phase 1 summary.)
2. **Missing cache-read prices.** The bundled price source does not state cache-read prices for claude-haiku-5-5 or claude-sonnet-5. Plan: assume 0.1x input for Haiku 5.5 and $0.20 for Sonnet 5, labelled as assumptions in the price table. OK?
3. **Model advisor sends prompt text to Haiku.** It goes to Anthropic through Claude Code's own model access. OK for the owner's use?
4. **Cold-cache guard asks every time.** Should it ask, or only warn (band turns red, toast) and let the prompt go?

## Next steps

- Owner reviews the Phase 1 PR and answers the open questions.
- Then task 1.

## Learned

- Claude Code session logs repeat an assistant entry once per content block with the same `message.id` and usage; de-duplicate by `message.id`.
- This machine's sessions write 1-hour cache entries (`usage.cache_creation.ephemeral_1h_input_tokens`).
