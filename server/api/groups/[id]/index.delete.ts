import { eq } from 'drizzle-orm'

// Only empty groups can be deleted, so projects are never removed by accident.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const group = await requireManageableGroup(event, id)
  const db = useDb()
  const project = await db.query.projects.findFirst({ where: eq(tables.projects.groupId, id), columns: { id: true } })
  if (project) {
    throw createError({ statusCode: 409, statusMessage: 'GROUP_NOT_EMPTY' })
  }
  await db.delete(tables.groups).where(eq(tables.groups.id, id))
  await logAudit(event, { action: 'group.delete', target: group.name, silent: !!group.ownerId })
  return { ok: true }
})
