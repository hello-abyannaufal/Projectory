import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const { techStackIds, ...input } = await readPatch(event, appPatch)
  const db = useDb()
  const [app] = Object.keys(input).length
    ? await db.update(tables.apps).set(input).where(eq(tables.apps.id, id)).returning()
    : await db.select().from(tables.apps).where(eq(tables.apps.id, id))
  if (!app) {
    notFound()
  }
  if (techStackIds) {
    await setAppTechStacks(id, techStackIds)
  }
  await touchProject(app.projectId)
  return app
})
