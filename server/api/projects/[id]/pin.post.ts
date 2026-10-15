export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const userId = (event.context.user as { id: string }).id
  await useDb().insert(tables.projectPins).values({ userId, projectId }).onConflictDoNothing()
  return { ok: true }
})
