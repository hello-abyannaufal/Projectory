import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, environmentInput.partial())
  const [environment] = await useDb().update(tables.environments).set(input).where(eq(tables.environments.id, id)).returning()
  if (!environment) {
    notFound()
  }
  await touchProject(environment.projectId)
  return environment
})
