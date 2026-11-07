# 0005. The repository root is the plugin root

Date: 2026-11-07. Status: superseded by 0007.

## Context

A Claude Code plugin is a folder holding `.claude-plugin/plugin.json`. The owner wants the project in `~/Development/active/` and wants the mod loaded in their own sessions; sharing with others may come later.

## Decision

Keep `.claude-plugin/plugin.json` and `hooks/` at the repository root. The owner's sessions load the folder through `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json`, which an interactive session also watches and hot-reloads. A marketplace file for `/plugin install` is added only when sharing is requested.

## Consequences

- No build or copy step between the repository and the running mod.
- Development files (tests, tools, configs) sit inside the plugin folder; the engine loads only what `hooks/hooks.json` names and what that module imports.
