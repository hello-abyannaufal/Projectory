import { eq } from 'drizzle-orm'

// Super user only (see server/middleware/auth.ts), so they can share the code.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const group = await useDb().query.groups.findFirst({ where: eq(tables.groups.id, id), columns: { accessCode: true } })
  if (!group) {
    notFound()
  }
  return { accessCode: group.accessCode ? decryptSecret(group.accessCode) : null }
})
