/**
 * Rejects any tracked or untracked (non-ignored) file outside the allowed layout.
 * The allowed list mirrors the directory layout in AGENTS.md.
 */
import { execFileSync } from 'node:child_process'

const ALLOWED: readonly RegExp[] = [
  /^(AGENTS|CLAUDE|DESIGN|PROGRESS|README)\.md$/,
  /^LICENSE$/,
  /^(package\.json|package-lock\.json|tsconfig\.json|tsconfig\.node\.json|knip\.json)$/,
  /^(eslint\.config\.js|commitlint\.config\.js|\.dependency-cruiser\.cjs)$/,
  /^(\.prettierrc\.json|\.prettierignore|\.gitignore|\.nvmrc)$/,
  /^\.claude-plugin\/plugin\.json$/,
  /^\.githooks\/(pre-commit|commit-msg)$/,
  /^\.github\/workflows\/[a-z0-9-]+\.yml$/,
  /^\.github\/pull_request_template\.md$/,
  /^docs\/decisions\/\d{4}-[a-z0-9-]+\.md$/,
  /^hooks\/(hooks\.json|register\.tsx)$/,
  /^src\/(core|analyzer)\/[a-z0-9-]+\.ts$/,
  /^src\/mod\/[a-z0-9-]+\.tsx?$/,
  /^tests\/node\/[a-z0-9-]+\.spec\.ts$/,
  /^tests\/mod\/[a-z0-9-]+\.test\.tsx?$/,
  /^tools\/[a-z0-9-]+\.ts$/,
  /^types\/index\.d\.ts$/,
]

export function disallowedPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => !ALLOWED.some((pattern) => pattern.test(path)))
}

function listedPaths(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate'],
    { encoding: 'utf8' },
  )
  return output.split('\0').filter((path) => path !== '')
}

if (import.meta.main) {
  const offenders = disallowedPaths(listedPaths())
  if (offenders.length > 0) {
    process.stderr.write(
      `Files outside the allowed layout (see AGENTS.md, Directory layout):\n${offenders.map((path) => `  ${path}`).join('\n')}\n`,
    )
    process.exit(1)
  }
}
