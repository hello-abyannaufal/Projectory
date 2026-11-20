import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const vpnId = getIdParam(event)
  const userId = (event.context.user as { id: string }).id
  const { groupVpnAccounts } = tables
  const [account] = await useDb().delete(groupVpnAccounts)
    .where(and(eq(groupVpnAccounts.vpnId, vpnId), eq(groupVpnAccounts.userId, userId)))
    .returning()
  if (!account) {
    notFound()
  }
  return { ok: true }
})
