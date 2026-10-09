import { eq, max } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const { techStackIds, ...input } = await readInput(event, appInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.apps.sortOrder) }).from(tables.apps).where(eq(tables.apps.projectId, projectId))
  const [app] = await db.insert(tables.apps)
    .values({ ...input, projectId, sortOrder: (last?.value ?? -1) + 1 })
    .returning()
  await setAppTechStacks(app!.id, techStackIds)
  await touchProject(projectId)
  return app
})
