import { eq } from 'drizzle-orm'

// Only empty groups can be deleted, so projects are never removed by accident.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const project = await db.query.projects.findFirst({ where: eq(tables.projects.groupId, id), columns: { id: true } })
  if (project) {
    throw createError({ statusCode: 409, statusMessage: 'GROUP_NOT_EMPTY' })
  }
  const [group] = await db.delete(tables.groups).where(eq(tables.groups.id, id)).returning()
  if (!group) {
    notFound()
  }
  await logAudit(event, { action: 'group.delete', target: group.name })
  return { ok: true }
})
