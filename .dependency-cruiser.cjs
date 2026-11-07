/** Module boundaries from DESIGN.md and docs/decisions/0002-module-boundaries.md. */
const PACKAGES = ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown']

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'core-is-pure',
      comment: 'src/core imports only src/core: no Node built-ins, no packages.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { pathNot: '^src/core/' },
    },
    {
      name: 'mod-runs-in-engine',
      comment:
        'The engine sandbox has no Node and no packages, and the mod never imports the analyzer.',
      severity: 'error',
      from: { path: '^(hooks|src/mod)/' },
      to: { path: '^(src/analyzer|tools)/' },
    },
    {
      name: 'mod-no-node',
      severity: 'error',
      from: { path: '^(hooks|src/mod)/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'hooks-only-through-mod',
      comment: 'hooks/register.tsx wires src/mod; it does not reach into core directly.',
      severity: 'error',
      from: { path: '^hooks/' },
      to: { path: '^src/', pathNot: '^src/mod/' },
    },
    {
      name: 'analyzer-not-mod',
      severity: 'error',
      from: { path: '^src/analyzer/' },
      to: { path: '^(hooks|src/mod|tools)/' },
    },
    {
      name: 'no-runtime-packages',
      comment: 'Runtime code depends on no npm packages.',
      severity: 'error',
      from: { path: '^(hooks|src)/' },
      to: { dependencyTypes: PACKAGES },
    },
    {
      name: 'tools-standalone',
      severity: 'error',
      from: { path: '^tools/' },
      to: { path: '^(hooks|src|tests)/' },
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
    exclude: { path: '^(node_modules|vendor|\\.scratch)/' },
    tsConfig: { fileName: 'tsconfig.node.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
}
