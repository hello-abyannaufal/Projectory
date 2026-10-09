import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const deployment = await findDeployment(id)
  const input = await readPatch(event, deploymentInput.partial())
  const [updated] = await useDb().update(tables.deployments).set(input).where(eq(tables.deployments.id, id)).returning()
  await touchProject(deployment.app.projectId)
  return updated
})
