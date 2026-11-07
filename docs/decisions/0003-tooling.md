# 0003. Tooling and the single check command

Date: 2026-11-07. Status: accepted.

## Context

Several agent sessions will work on this repository. Every check must run identically on a laptop, in the pre-commit hook and in CI.

## Decision

`npm run check` is the one command. In order:

1. **Prettier** (`prettier --check .`): formatting.
2. **ESLint** with typescript-eslint `strictTypeChecked` and `stylisticTypeChecked`, zero warnings allowed. Complexity limits: cyclomatic complexity 10, nesting depth 3, 4 parameters, 60 lines per function, 300 lines per file, 3 nested callbacks.
3. **tsc** in strict mode (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnused*`, `noImplicitReturns`) on `tsconfig.node.json` (Node) and, through `tools/engine-types.ts typecheck`, on `tsconfig.json` (mod; decision 0004).
4. **knip**: unused files, exports and dependencies.
5. **dependency-cruiser**: module boundaries (decision 0002) and no circular imports.
6. **Layout check** (`tools/check-layout.ts`): every tracked or untracked, non-ignored file must match the allowed list.
7. **Tests**: `node --test` for core, analyzer and tools; `claude plugin validate .` and `claude plugin test .` for the mod.

Wiring:

- `.githooks/pre-commit` runs `npm run check`; `.githooks/commit-msg` runs commitlint (`@commitlint/config-conventional`). `npm install` sets `core.hooksPath` through the `prepare` script, so no hook manager is needed.
- CI (`.github/workflows/ci.yml`) runs `npm ci` then `npm run check` in the `check` job, and commitlint over the pull request's commits in the `commits` job.
- Versions are pinned exactly in `package.json`, with `package-lock.json` committed.

TypeScript is pinned to 6.0.x because typescript-eslint 8.72 requires TypeScript below 6.1. TypeScript 7 (the native port) waits until typescript-eslint supports it.

## Consequences

- A commit that fails the check cannot be made locally without bypassing the hook, which AGENTS.md forbids.
- Lint is not run on `vendor/` or `.claude-plugin/types/` (the engine's generated types); that exclusion is set here, once, and not widened later. In CI only, engine-API code is also not linted (decision 0004).
- `@typescript-eslint/no-misused-promises` runs with `checksVoidReturn.arguments: false` in `hooks/`, `src/mod/` and `tests/mod/` only. With the default, ESLint never finishes (over 5 minutes, measured) on any call to the engine's `on(event, hook)`, whose overloads span every event type. The rest of the rule, `no-floating-promises` and the full rule in Node code still apply. Revisit when typescript-eslint or the engine types change.
- knip is told that `claude-code` is not an npm package (it is the engine's ambient module, decision 0004).
