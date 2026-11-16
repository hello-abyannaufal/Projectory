import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const file = await db.query.appFiles.findFirst({ where: eq(tables.appFiles.id, id), with: { app: { columns: { projectId: true } } } })
  if (!file) {
    notFound()
  }
  await db.delete(tables.appFiles).where(eq(tables.appFiles.id, id))
  await touchProject(file.app.projectId)
  return { ok: true }
})
