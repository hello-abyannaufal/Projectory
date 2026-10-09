import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const existing = await db.query.projects.findFirst({ where: eq(tables.projects.id, id), columns: { cover: true } })
  if (!existing) {
    notFound()
  }
  const cover = await saveImageUpload(event)
  await db.update(tables.projects).set({ cover }).where(eq(tables.projects.id, id))
  await deleteUpload(existing.cover)
  return { cover }
})
