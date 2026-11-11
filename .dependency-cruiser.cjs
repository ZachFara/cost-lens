/** Module boundaries from DESIGN.md and docs/decisions/0002-module-boundaries.md. */
const PACKAGES = ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown']

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'core-is-pure',
      comment: 'src/core imports only src/core: no Node built-ins, no packages.',
      severity: 'error',
      from: { path: '^plugin/src/core/' },
      to: { pathNot: '^plugin/src/core/' },
    },
    {
      name: 'mod-runs-in-engine',
      comment:
        'The engine sandbox has no Node and no packages, and the mod never imports the analyzer.',
      severity: 'error',
      from: { path: '^plugin/(hooks|src/mod)/' },
      to: { path: '^(plugin/src/analyzer|plugin/src/terminal|tools)/' },
    },
    {
      name: 'mod-no-node',
      severity: 'error',
      from: { path: '^plugin/(hooks|src/mod)/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'hooks-only-through-mod',
      comment: 'hooks/register.tsx wires src/mod; it does not reach into core directly.',
      severity: 'error',
      from: { path: '^plugin/hooks/' },
      to: { path: '^plugin/src/', pathNot: '^plugin/src/mod/' },
    },
    {
      name: 'analyzer-not-mod',
      severity: 'error',
      from: { path: '^plugin/src/analyzer/' },
      to: { path: '^(plugin/hooks|plugin/src/mod|plugin/src/terminal|tools)/' },
    },
    {
      name: 'terminal-on-core',
      comment:
        'The terminal view runs under Node: core and Node built-ins only; it starts the analyzer as a program.',
      severity: 'error',
      from: { path: '^plugin/src/terminal/' },
      to: { path: '^(plugin/hooks|plugin/src/mod|plugin/src/analyzer|tools)/' },
    },
    {
      name: 'no-runtime-packages',
      comment: 'Runtime code depends on no npm packages.',
      severity: 'error',
      from: { path: '^plugin/(hooks|src)/' },
      to: { dependencyTypes: PACKAGES },
    },
    {
      name: 'tools-standalone',
      severity: 'error',
      from: { path: '^tools/' },
      to: { path: '^(plugin|tests)/' },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        'Every import resolves, except the engine ambient module claude-code (decision 0004).',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^claude-code(/testing)?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(node_modules|vendor|dist|\\.scratch|plugin/\\.claude-plugin/types)/' },
    tsConfig: { fileName: 'tsconfig.node.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
}
