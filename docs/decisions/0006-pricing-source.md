# 0006. Prices come from Anthropic's pricing page

Date: 2026-11-07. Status: accepted.

## Context

Costs are estimated from token counts, so the price table decides every dollar figure cost-lens shows. The first source used in design, a price table cached inside the Claude Code API skill on 2026-10-06, lacked cache-read prices for Claude Haiku 5.5 and Claude Sonnet 5 and gave a wrong one for Claude Sonnet 5.5 ($0.20 per million tokens; the real price is $0.10). Anthropic publishes the full table, including 5-minute and 1-hour cache-write prices, at `https://platform.claude.com/docs/en/about-claude/pricing`, and serves the same page as markdown at `https://platform.claude.com/docs/en/about-claude/pricing.md`.

## Decision

- The price table in `src/core/` is a snapshot of that page's "Model pricing" table, with the fetch date and URL in a comment. Each model has base input, 5-minute cache write, 1-hour cache write, cache read and output prices, copied as published rather than derived from multipliers.
- Claude Haiku 5.5 has two rows: prompts up to 100,000 tokens and prompts over 100,000 tokens.
- Modifiers from the same page apply per request, as the logs record them: `speed: "fast"` uses fast-mode prices, and `inference_geo: "us"` multiplies every category by 1.1.
- With `--live-prices` (the mod always passes it; tests and CI never do), the analyzer fetches the markdown page at most once a local day, parses its "Model pricing" table (`src/core/price-page.ts`), caches it in `~/Library/Caches/cost-lens/prices.json`, and prices with it; fast-mode rates, in a separate table, stay from the snapshot. When the page cannot be fetched or parsed (fewer than five models), the last cached prices stand, else the snapshot.
- The same table says which models Anthropic offers: the analyzer's summary carries its model ids, and each model-recommendation tier recommends the newest version of its family listed there (`src/core/models.ts`), so a new release such as Claude Fable 5.2 is recommended without a code change. Before the first summary of a session, and offline, the snapshot's newest stands. (Added 2026-11-10.)
- Community price lists (such as LiteLLM's model price JSON) are not used: the vendor's own page is authoritative and machine-readable.

## Consequences

- Prices match what Anthropic bills on the first-party API. Amazon Bedrock and Google Vertex AI prices differ and are not modelled.
- A price change on the page reaches the pane within a day with no code change. The pane names the date of the prices it used.
- If Anthropic changes the page's layout, the parser falls back to the snapshot rather than showing wrong numbers.
