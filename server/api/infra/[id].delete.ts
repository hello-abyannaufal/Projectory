import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [item] = await useDb().delete(tables.infraItems).where(eq(tables.infraItems.id, id)).returning()
  if (!item) {
    notFound()
  }
  await touchProject(item.projectId)
  return { ok: true }
})
