import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, projectPatch)
  const [project] = await useDb().update(tables.projects).set(input).where(eq(tables.projects.id, id)).returning()
  if (!project) {
    notFound()
  }
  return project
})
