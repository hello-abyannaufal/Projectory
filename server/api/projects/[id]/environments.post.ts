import { eq, max } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const input = await readInput(event, environmentInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.environments.sortOrder) }).from(tables.environments).where(eq(tables.environments.projectId, projectId))
  const [environment] = await db.insert(tables.environments)
    .values({ ...input, projectId, sortOrder: (last?.value ?? -1) + 1 })
    .returning()
  await touchProject(projectId)
  return environment
})
