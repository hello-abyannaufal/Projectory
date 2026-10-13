import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const described = await describeProject(id)
  const [project] = await useDb().delete(tables.projects).where(eq(tables.projects.id, id)).returning()
  if (!project) {
    notFound()
  }
  await deleteUpload(project.cover)
  await logAudit(event, { action: 'project.delete', ...described })
  return { ok: true }
})
