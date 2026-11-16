import { eq, max } from 'drizzle-orm'

// Adds a variable, or updates the value when the key already exists.
export default defineEventHandler(async (event) => {
  const file = await findEnvFile(getIdParam(event))
  const deployment = await findDeployment(file.deploymentId)
  assertNotProduction(deployment)
  const { key, value } = await readInput(event, envVarInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.envVars.sortOrder) }).from(tables.envVars).where(eq(tables.envVars.envFileId, file.id))
  const encrypted = encryptSecret(value)
  await withEnvHistory(event, file, 'edit', () => db.insert(tables.envVars)
    .values({ deploymentId: file.deploymentId, envFileId: file.id, key, value: encrypted, sortOrder: (last?.value ?? -1) + 1 })
    .onConflictDoUpdate({ target: [tables.envVars.envFileId, tables.envVars.key], set: { value: encrypted } }))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
