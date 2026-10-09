import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const deployment = await findDeployment(id)
  await useDb().delete(tables.deployments).where(eq(tables.deployments.id, id))
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
