import { eq } from 'drizzle-orm'
import * as z from 'zod'

const createInput = groupVpnInput.extend({ groupId: z.uuid() })

export default defineEventHandler(async (event) => {
  const { groupId, ...input } = await readInput(event, createInput)
  await assertGroupOpen(event, groupId)
  const db = useDb()
  const group = await db.query.groups.findFirst({ where: eq(tables.groups.id, groupId), columns: { id: true } })
  if (!group) {
    notFound()
  }
  const [vpn] = await db.insert(tables.groupVpns).values({ ...input, groupId }).returning()
  return vpn
})
