import { and, eq } from 'drizzle-orm'

// A user's own password for a VPN, so it is not a secret reveal for other roles
// and is not audited. Nobody else's login is ever returned.
export default defineEventHandler(async (event) => {
  const vpnId = getIdParam(event)
  const userId = (event.context.user as { id: string }).id
  const { groupVpnAccounts } = tables
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const account = await useDb().query.groupVpnAccounts.findFirst({
    where: and(eq(groupVpnAccounts.vpnId, vpnId), eq(groupVpnAccounts.userId, userId)),
    columns: { password: true }
  })
  if (!account) {
    notFound()
  }
  return { password: account.password ? decryptSecret(account.password) : '' }
})
