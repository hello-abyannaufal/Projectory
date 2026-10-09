import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [release] = await useDb().delete(tables.releases).where(eq(tables.releases.id, id)).returning()
  if (!release) {
    notFound()
  }
  return { ok: true }
})
