import { eq } from 'drizzle-orm'

// Deletes the file with its variables and history.
export default defineEventHandler(async (event) => {
  const file = await findEnvFile(getIdParam(event))
  const deployment = await findDeployment(file.deploymentId)
  assertNotProduction(deployment)
  await useDb().delete(tables.envFiles).where(eq(tables.envFiles.id, file.id))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
