# 0001. TypeScript for the mod and the analyzer

Date: 2026-11-07. Status: accepted.

## Context

The mod must be TypeScript or JavaScript: the Claude Code engine loads hooks modules only in those languages. The analyzer reads about 1.1 GB of local JSONL logs, which the mod's sandbox cannot do efficiently (no Node, files only through `$.fs`), so it runs as a separate process. The machine has Node 26 (which runs `.ts` files directly) and the system Python 3.9.6.

## Decision

Write both in TypeScript. The analyzer runs as `node src/analyzer/cli.ts`, with no build step and no runtime dependencies. Pricing and cost math live once in `src/core/` and are imported by both.

## Consequences

- One language, one linter, one type checker, one formatter.
- Shared logic cannot drift between two languages.
- Node 26 or later is required (`.nvmrc`, `engines`). Node code may use only erasable TypeScript syntax (`erasableSyntaxOnly`), and relative imports spell the `.ts` extension.
- Python was rejected: the system version is old, and it would duplicate the price table and cost math.
