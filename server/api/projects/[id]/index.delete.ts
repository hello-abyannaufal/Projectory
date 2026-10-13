import { and, eq, isNull } from 'drizzle-orm'

// Moves the project to the trash; see server/api/trash for restore and purge.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const user = event.context.user as { name: string }
  const [project] = await useDb().update(tables.projects)
    .set({ deletedAt: new Date(), deletedBy: user.name })
    .where(and(eq(tables.projects.id, id), isNull(tables.projects.deletedAt)))
    .returning({ id: tables.projects.id })
  if (!project) {
    notFound()
  }
  await logAudit(event, { action: 'project.delete', ...await describeProject(id) })
  return { ok: true }
})
