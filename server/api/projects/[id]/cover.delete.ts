import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [old] = await useDb().select({ cover: tables.projects.cover }).from(tables.projects).where(eq(tables.projects.id, id))
  if (!old) {
    notFound()
  }
  await useDb().update(tables.projects).set({ cover: null }).where(eq(tables.projects.id, id))
  await deleteUpload(old.cover)
  return { ok: true }
})
