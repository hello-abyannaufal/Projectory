import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const existing = await db.query.envVars.findFirst({ where: eq(tables.envVars.id, id), columns: { deploymentId: true } })
  if (!existing) {
    notFound()
  }
  await withEnvHistory(event, existing.deploymentId, 'delete', () => db.delete(tables.envVars).where(eq(tables.envVars.id, id)))
  const deployment = await findDeployment(existing.deploymentId)
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
