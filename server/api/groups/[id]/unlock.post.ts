import { and, count, eq, gt, sql } from 'drizzle-orm'
import * as z from 'zod'

const unlockInput = z.object({ accessCode: z.string().max(64) })

// Wrong codes this user entered for the group within the window, counted from
// the audit log so the limit holds across sessions and server restarts.
async function recentFailures(userId: string, groupId: string) {
  const { auditLogs } = tables
  const since = new Date(Date.now() - GROUP_UNLOCK_WINDOW_MINUTES * 60_000)
  const [row] = await useDb().select({ value: count() }).from(auditLogs).where(and(
    eq(auditLogs.userId, userId),
    eq(auditLogs.action, 'group.unlock_failed'),
    sql`${auditLogs.metadata}->>'groupId' = ${groupId}`,
    gt(auditLogs.createdAt, since)
  ))
  return row?.value ?? 0
}

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const { accessCode } = await readInput(event, unlockInput)
  const db = useDb()
  const group = await db.query.groups.findFirst({ where: eq(tables.groups.id, id), columns: { accessCode: true } })
  if (!group) {
    notFound()
  }
  if (group.accessCode) {
    const userId = (event.context.user as { id: string }).id
    if (await recentFailures(userId, id) >= GROUP_UNLOCK_MAX_FAILURES) {
      throw createError({ statusCode: 429, statusMessage: 'TOO_MANY_ATTEMPTS' })
    }
    if (!accessCodeMatches(group.accessCode, accessCode.trim())) {
      await logAudit(event, { action: 'group.unlock_failed', target: await describeGroup(id), metadata: { groupId: id } })
      throw createError({ statusCode: 403, statusMessage: 'INVALID_ACCESS_CODE' })
    }
    const sessionId = (event.context.session as { id: string }).id
    await db.insert(tables.groupUnlocks).values({ sessionId, groupId: id }).onConflictDoNothing()
    await logAudit(event, { action: 'group.unlock', target: await describeGroup(id) })
  }
  return { ok: true }
})
