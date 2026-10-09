import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const existing = await db.query.envVars.findFirst({ where: eq(tables.envVars.id, id), columns: { deploymentId: true } })
  if (!existing) {
    notFound()
  }
  const deployment = await findDeployment(existing.deploymentId)
  assertNotProduction(deployment)
  const { key, value } = await readInput(event, envVarInput.partial())
  try {
    await db.update(tables.envVars)
      .set({ ...(key ? { key } : {}), ...(value !== undefined ? { value: encryptSecret(value) } : {}) })
      .where(eq(tables.envVars.id, id))
  } catch {
    throw createError({ statusCode: 409, statusMessage: `${key} already exists` })
  }
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
