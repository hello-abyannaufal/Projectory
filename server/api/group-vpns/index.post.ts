import { eq } from 'drizzle-orm'
import * as z from 'zod'

const createInput = groupVpnInput.extend({ groupId: z.uuid() })

export default defineEventHandler(async (event) => {
  const { groupId, ...input } = await readInput(event, createInput)
  await assertGroupOpen(event, groupId)
  const db = useDb()
  const group = await db.query.groups.findFirst({ where: eq(tables.groups.id, groupId), columns: { id: true, ownerId: true } })
  if (!group) {
    notFound()
  }
  if (group.ownerId) {
    throw createError({ statusCode: 400, statusMessage: 'A private group has no VPNs' })
  }
  const [vpn] = await db.insert(tables.groupVpns).values({ ...input, groupId }).returning()
  return vpn
})
