# 0006. Prices come from Anthropic's pricing page

Date: 2026-11-07. Status: accepted.

## Context

Costs are estimated from token counts, so the price table decides every dollar figure cost-lens shows. The first source used in design, a price table cached inside the Claude Code API skill on 2026-10-06, lacked cache-read prices for Claude Haiku 5.5 and Claude Sonnet 5 and gave a wrong one for Claude Sonnet 5.5 ($0.20 per million tokens; the real price is $0.10). Anthropic publishes the full table, including 5-minute and 1-hour cache-write prices, at `https://platform.claude.com/docs/en/about-claude/pricing`, and serves the same page as markdown at `https://platform.claude.com/docs/en/about-claude/pricing.md`.

## Decision

- The price table in `src/core/` is a snapshot of that page's "Model pricing" table, with the fetch date and URL in a comment. Each model has base input, 5-minute cache write, 1-hour cache write, cache read and output prices, copied as published rather than derived from multipliers.
- Claude Haiku 5.5 has two rows: prompts up to 100,000 tokens and prompts over 100,000 tokens.
- Modifiers from the same page apply per request, as the logs record them: `speed: "fast"` uses fast-mode prices, and `inference_geo: "us"` multiplies every category by 1.1.
- A later task (PROGRESS.md, task 13) fetches the markdown page at most once a day and parses it, falling back to the snapshot.
- Community price lists (such as LiteLLM's model price JSON) are not used: the vendor's own page is authoritative and machine-readable.

## Consequences

- Prices match what Anthropic bills on the first-party API. Amazon Bedrock and Google Vertex AI prices differ and are not modelled.
- Until task 13 lands, a price change needs a code change. The pane says which snapshot date it uses.
- If Anthropic changes the page's layout, the parser falls back to the snapshot rather than showing wrong numbers.
