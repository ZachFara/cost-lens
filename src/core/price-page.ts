import type { ModelPrice, Rates } from './pricing.ts'

const MIN_MODELS = 5

/** "Claude Opus 5.5" reads `claude-opus-5-5`. */
function modelId(name: string): string {
  return `claude-${name
    .replace(/^Claude /, '')
    .toLowerCase()
    .replace(/[ .]+/g, '-')}`
}

function dollars(cell: string): number | undefined {
  const amount = /^\$([\d.]+) \/ MTok/.exec(cell)?.[1]
  const value = amount === undefined ? Number.NaN : Number(amount)
  return Number.isFinite(value) ? value : undefined
}

interface Row {
  id: string
  isLongPrompt: boolean
  rates: Rates
}

function parseRow(line: string): Row | undefined {
  const cells = line.split('|').map((cell) => cell.trim())
  const [name = '', ...prices] = cells.slice(1, -1)
  const values = prices.map(dollars)
  if (values.length !== 5 || values.some((value) => value === undefined)) return undefined
  const [input = 0, write5m = 0, write1h = 0, read = 0, output = 0] = values as number[]
  return {
    id: modelId(name.replace(/\s*\(.*$/, '')),
    isLongPrompt: name.includes('over 100,000 tokens'),
    rates: { input, write5m, write1h, read, output },
  }
}

function modelPricingRows(markdown: string): string[] {
  const start = markdown.indexOf('## Model pricing')
  if (start < 0) return []
  const end = markdown.indexOf('\n## ', start + 1)
  const section = markdown.slice(start, end < 0 ? undefined : end)
  return section.split('\n').filter((line) => line.startsWith('| Claude '))
}

/**
 * The "Model pricing" table of Anthropic's pricing page (markdown). Untrusted: rows that
 * do not read as a model and five prices are skipped, and a table with fewer than five
 * models is rejected so the caller falls back to the snapshot.
 */
export function parsePricingPage(markdown: string): ModelPrice[] | undefined {
  const byId = new Map<string, ModelPrice>()
  for (const row of modelPricingRows(markdown).map(parseRow)) {
    if (row === undefined) continue
    const known = byId.get(row.id)
    if (row.isLongPrompt && known !== undefined) known.longPrompt = row.rates
    else if (!row.isLongPrompt) byId.set(row.id, { id: row.id, rates: row.rates })
  }
  return byId.size >= MIN_MODELS ? [...byId.values()] : undefined
}
