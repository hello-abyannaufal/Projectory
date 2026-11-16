import { eq, max } from 'drizzle-orm'

// Adds an .env file to the deployment.
export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  assertNotProduction(deployment)
  const { path } = await readInput(event, envFileInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.envFiles.sortOrder) }).from(tables.envFiles).where(eq(tables.envFiles.deploymentId, deploymentId))
  try {
    const [file] = await db.insert(tables.envFiles).values({ deploymentId, path, sortOrder: (last?.value ?? -1) + 1 }).returning()
    await touchProject(deployment.app.projectId)
    return file
  } catch {
    throw createError({ statusCode: 409, statusMessage: `${path} already exists` })
  }
})
