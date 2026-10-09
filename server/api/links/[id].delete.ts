import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [link] = await useDb().delete(tables.links).where(eq(tables.links.id, id)).returning()
  if (!link) {
    notFound()
  }
  await touchProject(link.projectId)
  return { ok: true }
})
