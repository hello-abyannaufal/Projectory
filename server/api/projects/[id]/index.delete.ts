import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [project] = await useDb().delete(tables.projects).where(eq(tables.projects.id, id)).returning()
  if (!project) {
    notFound()
  }
  await deleteUpload(project.cover)
  return { ok: true }
})
