import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname } from 'node:path'

import { parsePlan, planFile } from '../core/plan.ts'

/**
 * Saves the plan usage reading the mod passes (`--save-plan <json>`) where the terminal
 * view reads it. False, and nothing written, when the text is not a reading.
 */
export async function savePlan(text: string, path = planFile(homedir())): Promise<boolean> {
  const plan = parsePlan(text)
  if (plan === undefined) return false
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(plan))
  return true
}
