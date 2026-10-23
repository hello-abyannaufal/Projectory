import { eq } from 'drizzle-orm'

// Deletes every variable of the deployment.
export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  assertNotProduction(deployment)
  await withEnvHistory(event, deploymentId, 'delete_all', () =>
    useDb().delete(tables.envVars).where(eq(tables.envVars.deploymentId, deploymentId)))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
