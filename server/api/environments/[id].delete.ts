import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [environment] = await useDb().delete(tables.environments).where(eq(tables.environments.id, id)).returning()
  if (!environment) {
    notFound()
  }
  await touchProject(environment.projectId)
  return { ok: true }
})
