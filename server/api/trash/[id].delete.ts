import { and, eq, isNotNull } from 'drizzle-orm'

// Deletes a project in the trash for good.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const project = await useDb().query.projects.findFirst({
    where: and(eq(tables.projects.id, id), isNotNull(tables.projects.deletedAt)),
    columns: { groupId: true }
  })
  if (!project) {
    notFound()
  }
  await assertGroupOpen(event, project.groupId)
  const described = await describeProject(id)
  await purgeProject(id)
  await logAudit(event, { action: 'project.purge', ...described })
  return { ok: true }
})
