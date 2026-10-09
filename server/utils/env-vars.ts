import { and, eq, inArray } from 'drizzle-orm'
import type { EnvEntry } from '#shared/utils/dotenv'

export async function readEnvVars(deploymentId: string) {
  const rows = await useDb().select().from(tables.envVars).where(eq(tables.envVars.deploymentId, deploymentId))
  return rows
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map(row => ({ id: row.id, key: row.key, value: decryptSecret(row.value), sortOrder: row.sortOrder }))
}

export function diffEnvVars(current: EnvEntry[], incoming: EnvEntry[]) {
  const currentMap = new Map(current.map(entry => [entry.key, entry.value]))
  const incomingKeys = new Set(incoming.map(entry => entry.key))
  return {
    added: incoming.filter(entry => !currentMap.has(entry.key)).map(entry => entry.key),
    changed: incoming.filter(entry => currentMap.has(entry.key) && currentMap.get(entry.key) !== entry.value).map(entry => entry.key),
    unchanged: incoming.filter(entry => currentMap.get(entry.key) === entry.value).map(entry => entry.key),
    removed: current.filter(entry => !incomingKeys.has(entry.key)).map(entry => entry.key)
  }
}

export async function applyEnvVars(
  deploymentId: string,
  incoming: EnvEntry[],
  options: { skip: string[], replace: boolean }
) {
  const current = await readEnvVars(deploymentId)
  const diff = diffEnvVars(current, incoming)
  const skip = new Set(options.skip)
  const byKey = new Map(current.map(entry => [entry.key, entry]))
  const nextOrder = Math.max(-1, ...current.map(entry => entry.sortOrder)) + 1

  await useDb().transaction(async (tx) => {
    for (const [index, entry] of incoming.entries()) {
      const existing = byKey.get(entry.key)
      if (!existing) {
        await tx.insert(tables.envVars).values({
          deploymentId,
          key: entry.key,
          value: encryptSecret(entry.value),
          sortOrder: options.replace ? index : nextOrder + index
        })
      } else if (diff.changed.includes(entry.key) && !skip.has(entry.key)) {
        await tx.update(tables.envVars)
          .set({ value: encryptSecret(entry.value), ...(options.replace ? { sortOrder: index } : {}) })
          .where(eq(tables.envVars.id, existing.id))
      } else if (options.replace) {
        await tx.update(tables.envVars).set({ sortOrder: index }).where(eq(tables.envVars.id, existing.id))
      }
    }
    if (options.replace && diff.removed.length) {
      await tx.delete(tables.envVars).where(and(eq(tables.envVars.deploymentId, deploymentId), inArray(tables.envVars.key, diff.removed)))
    }
  })

  return diff
}
