import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [envVar] = await useDb().delete(tables.envVars).where(eq(tables.envVars.id, id)).returning()
  if (!envVar) {
    notFound()
  }
  const deployment = await findDeployment(envVar.deploymentId)
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
