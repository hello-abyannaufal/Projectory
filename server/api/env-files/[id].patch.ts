import { eq } from 'drizzle-orm'

// Renames an .env file; its variables and history stay with it.
export default defineEventHandler(async (event) => {
  const file = await findEnvFile(getIdParam(event))
  const deployment = await findDeployment(file.deploymentId)
  assertNotProduction(deployment)
  const { path } = await readInput(event, envFileInput)
  try {
    await useDb().update(tables.envFiles).set({ path }).where(eq(tables.envFiles.id, file.id))
  } catch {
    throw createError({ statusCode: 409, statusMessage: `${path} already exists` })
  }
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
