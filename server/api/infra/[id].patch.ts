import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readPatch(event, infraInput.partial())
  const db = useDb()
  const existing = await db.query.infraItems.findFirst({ where: eq(tables.infraItems.id, id) })
  if (!existing) {
    notFound()
  }
  await assertProjectEnvironment(existing.projectId, input.environmentId)
  const [item] = await db.update(tables.infraItems).set(input).where(eq(tables.infraItems.id, id)).returning()
  await touchProject(existing.projectId)
  return item
})
