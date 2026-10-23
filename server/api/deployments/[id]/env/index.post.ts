import { eq, max } from 'drizzle-orm'

// Adds a variable, or updates the value when the key already exists.
export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  assertNotProduction(deployment)
  const { key, value } = await readInput(event, envVarInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.envVars.sortOrder) }).from(tables.envVars).where(eq(tables.envVars.deploymentId, deploymentId))
  const encrypted = encryptSecret(value)
  await withEnvHistory(event, deploymentId, 'edit', () => db.insert(tables.envVars)
    .values({ deploymentId, key, value: encrypted, sortOrder: (last?.value ?? -1) + 1 })
    .onConflictDoUpdate({ target: [tables.envVars.deploymentId, tables.envVars.key], set: { value: encrypted } }))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
