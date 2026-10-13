import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  const userId = (event.context.user as { id: string }).id
  await useDb().delete(tables.projectPins)
    .where(and(eq(tables.projectPins.userId, userId), eq(tables.projectPins.projectId, projectId)))
  return { ok: true }
})
