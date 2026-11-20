import { and, asc, eq } from 'drizzle-orm'
import * as z from 'zod'

const vpnQuery = z.object({ groupId: z.uuid() })

// Each VPN comes with the signed-in user's own login for it, if they saved one.
// The password is never listed; see account/password.get.ts. A locked group
// needs its access code first.
export default defineEventHandler(async (event) => {
  const { groupId } = await getValidatedQuery(event, query => vpnQuery.parse(query))
  await assertGroupOpen(event, groupId)
  const userId = (event.context.user as { id: string }).id
  const { groupVpns, groupVpnAccounts } = tables
  const rows = await useDb()
    .select({
      id: groupVpns.id,
      name: groupVpns.name,
      host: groupVpns.host,
      notes: groupVpns.notes,
      accountId: groupVpnAccounts.id,
      username: groupVpnAccounts.username,
      password: groupVpnAccounts.password,
      accountNotes: groupVpnAccounts.notes
    })
    .from(groupVpns)
    .leftJoin(groupVpnAccounts, and(eq(groupVpnAccounts.vpnId, groupVpns.id), eq(groupVpnAccounts.userId, userId)))
    .where(eq(groupVpns.groupId, groupId))
    .orderBy(asc(groupVpns.name))
  return rows.map(({ accountId, username, password, accountNotes, ...vpn }) => ({
    ...vpn,
    account: accountId ? { username: username!, hasPassword: !!password, notes: accountNotes } : null
  }))
})
