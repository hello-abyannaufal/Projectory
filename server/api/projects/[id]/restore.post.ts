import { and, eq, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const [project] = await useDb().update(tables.projects)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(tables.projects.id, id), isNotNull(tables.projects.deletedAt)))
    .returning({ id: tables.projects.id })
  if (!project) {
    notFound()
  }
  await logAudit(event, { action: 'project.restore', ...await describeProject(id) })
  return project
})
