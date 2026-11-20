import { eq } from 'drizzle-orm'

// The group's lock is checked in server/middleware/auth.ts.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readPatch(event, groupVpnInput.partial())
  const [vpn] = await useDb().update(tables.groupVpns).set(input).where(eq(tables.groupVpns.id, id)).returning()
  if (!vpn) {
    notFound()
  }
  return vpn
})
