# cost-lens

A Claude Code mod that shows where your Claude Code tokens and dollars go, warns before a message rebuilds a cold prompt cache, and suggests a cheaper model for routine prompts.

Status: repository setup. See `PROGRESS.md` for what is built and what is next, and `DESIGN.md` for the plan.

## Develop

```sh
npm install        # also installs the git hooks
claude --plugin-dir .   # once, so Claude Code writes its mod API types
npm run engine-types    # copy them into vendor/ (gitignored)
npm run check      # everything CI runs
claude --plugin-dir .   # try the mod in a session
```

Agents: start with `AGENTS.md`.
