import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [app] = await useDb().delete(tables.apps).where(eq(tables.apps.id, id)).returning()
  if (!app) {
    notFound()
  }
  await touchProject(app.projectId)
  return { ok: true }
})
