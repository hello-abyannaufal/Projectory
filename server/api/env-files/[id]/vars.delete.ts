import { eq } from 'drizzle-orm'

// Deletes every variable of the file.
export default defineEventHandler(async (event) => {
  const file = await findEnvFile(getIdParam(event))
  const deployment = await findDeployment(file.deploymentId)
  assertNotProduction(deployment)
  await withEnvHistory(event, file, 'delete_all', () =>
    useDb().delete(tables.envVars).where(eq(tables.envVars.envFileId, file.id)))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
