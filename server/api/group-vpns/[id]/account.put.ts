import { and, eq } from 'drizzle-orm'

// Saves the signed-in user's own login for a VPN. Only the owner ever reads it.
export default defineEventHandler(async (event) => {
  const vpnId = getIdParam(event)
  const userId = (event.context.user as { id: string }).id
  const input = await readInput(event, groupVpnAccountInput)
  const db = useDb()
  const { groupVpns, groupVpnAccounts } = tables
  const vpn = await db.query.groupVpns.findFirst({ where: eq(groupVpns.id, vpnId), columns: { id: true } })
  if (!vpn) {
    notFound()
  }
  const values = {
    username: input.username,
    notes: input.notes,
    ...(input.password === undefined ? {} : { password: input.password ? encryptSecret(input.password) : '' })
  }
  await db.insert(groupVpnAccounts)
    .values({ ...values, vpnId, userId })
    .onConflictDoUpdate({ target: [groupVpnAccounts.vpnId, groupVpnAccounts.userId], set: { ...values, updatedAt: new Date() } })
  const [account] = await db.select({ username: groupVpnAccounts.username, notes: groupVpnAccounts.notes })
    .from(groupVpnAccounts)
    .where(and(eq(groupVpnAccounts.vpnId, vpnId), eq(groupVpnAccounts.userId, userId)))
  return account
})
