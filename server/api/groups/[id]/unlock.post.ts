import { eq } from 'drizzle-orm'
import * as z from 'zod'

const unlockInput = z.object({ accessCode: z.string().max(64) })

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const { accessCode } = await readInput(event, unlockInput)
  const db = useDb()
  const group = await db.query.groups.findFirst({ where: eq(tables.groups.id, id), columns: { accessCode: true } })
  if (!group) {
    notFound()
  }
  if (group.accessCode) {
    if (!accessCodeMatches(group.accessCode, accessCode.trim())) {
      await logAudit(event, { action: 'group.unlock_failed', target: await describeGroup(id) })
      throw createError({ statusCode: 403, statusMessage: 'INVALID_ACCESS_CODE' })
    }
    const sessionId = (event.context.session as { id: string }).id
    await db.insert(tables.groupUnlocks).values({ sessionId, groupId: id }).onConflictDoNothing()
    await logAudit(event, { action: 'group.unlock', target: await describeGroup(id) })
  }
  return { ok: true }
})
