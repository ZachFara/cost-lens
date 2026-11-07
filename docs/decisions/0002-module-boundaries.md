# 0002. Three runtimes, four modules, enforced boundaries

Date: 2026-11-07. Status: accepted.

## Context

Code runs in three places: the engine's sandbox (the mod: no Node, no DOM, no npm packages), Node (the analyzer), and both (shared logic). Importing a Node built-in from mod code fails at load time in a session, not at type-check time.

## Decision

- `src/core/`: pure, imports only `src/core/`.
- `src/analyzer/`: imports `src/core/` and Node built-ins.
- `src/mod/` and `hooks/`: import `src/core/`, `src/mod/` and `claude-code` types; never Node built-ins, packages or the analyzer.
- `tools/`: Node built-ins only.
- The mod starts the analyzer as a child process (`$.process.run(["node", ...])`) and reads its JSON from stdout.
- Runtime code depends on no npm packages.

dependency-cruiser enforces these rules in `npm run check` (`.dependency-cruiser.cjs`).

## Consequences

- A Node import in mod code fails the check, not a live session.
- The analyzer can be run and tested on its own.
- Anything needed by both runtimes must be written without I/O and placed in `src/core/`.
