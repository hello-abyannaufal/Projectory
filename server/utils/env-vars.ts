import { and, desc, eq, inArray, notInArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
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

export function decryptEnvVersion(content: string) {
  return JSON.parse(decryptSecret(content)) as EnvEntry[]
}

export async function findEnvVersion(id: string) {
  const version = await useDb().query.envVarVersions.findFirst({ where: eq(tables.envVarVersions.id, id) })
  if (!version) {
    notFound()
  }
  return version
}

async function latestEnvVersion(deploymentId: string) {
  return useDb().query.envVarVersions.findFirst({
    where: eq(tables.envVarVersions.deploymentId, deploymentId),
    orderBy: desc(tables.envVarVersions.createdAt)
  })
}

async function saveEnvVersion(deploymentId: string, entries: EnvEntry[], action: EnvVersionAction, user?: { id: string, name: string }) {
  const db = useDb()
  await db.insert(tables.envVarVersions).values({
    deploymentId,
    content: encryptSecret(JSON.stringify(entries)),
    action,
    userId: user?.id ?? null,
    userName: user?.name ?? null
  })
  const keep = db.select({ id: tables.envVarVersions.id }).from(tables.envVarVersions)
    .where(eq(tables.envVarVersions.deploymentId, deploymentId))
    .orderBy(desc(tables.envVarVersions.createdAt))
    .limit(ENV_HISTORY_LIMIT)
  await db.delete(tables.envVarVersions)
    .where(and(eq(tables.envVarVersions.deploymentId, deploymentId), notInArray(tables.envVarVersions.id, keep)))
}

const entriesOf = (vars: { key: string, value: string }[]) => vars.map(({ key, value }) => ({ key, value }))

// Runs a change to a deployment's .env and records the result as a version.
// Values from before the first recorded change are saved as a baseline first.
export async function withEnvHistory<T>(event: H3Event, deploymentId: string, action: EnvVersionAction, change: () => Promise<T>) {
  if (!await latestEnvVersion(deploymentId)) {
    const before = await readEnvVars(deploymentId)
    if (before.length) {
      await saveEnvVersion(deploymentId, entriesOf(before), 'baseline')
    }
  }
  const result = await change()
  const after = entriesOf(await readEnvVars(deploymentId))
  const latest = await latestEnvVersion(deploymentId)
  const unchanged = latest && JSON.stringify(decryptEnvVersion(latest.content)) === JSON.stringify(after)
  if (!unchanged && (latest || after.length)) {
    await saveEnvVersion(deploymentId, after, action, event.context.user as { id: string, name: string })
  }
  return result
}
