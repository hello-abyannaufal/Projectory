import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [vpn] = await useDb().delete(tables.groupVpns).where(eq(tables.groupVpns.id, id)).returning()
  if (!vpn) {
    notFound()
  }
  return { ok: true }
})
