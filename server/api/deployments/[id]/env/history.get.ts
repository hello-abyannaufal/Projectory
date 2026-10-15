import { desc, eq } from 'drizzle-orm'

// Versions newest first, with the keys each one changed. Values come from
// /api/env-versions/:id/reveal.
export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const versions = await useDb().query.envVarVersions.findMany({
    where: eq(tables.envVarVersions.deploymentId, deploymentId),
    orderBy: desc(tables.envVarVersions.createdAt)
  })
  const entries = versions.map(version => decryptEnvVersion(version.content))
  return versions.map(({ id, action, userName, createdAt }, index) => {
    const diff = diffEnvVars(entries[index + 1] ?? [], entries[index]!)
    return {
      id,
      action: action as EnvVersionAction,
      userName,
      createdAt,
      keyCount: entries[index]!.length,
      added: diff.added,
      changed: diff.changed,
      removed: diff.removed
    }
  })
})
