import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const file = await db.query.appFiles.findFirst({ where: eq(tables.appFiles.id, id), with: { app: { columns: { projectId: true } } } })
  if (!file) {
    notFound()
  }
  const { path, content } = await readInput(event, appFileInput.partial())
  try {
    await db.update(tables.appFiles)
      .set({ ...(path ? { path } : {}), ...(content !== undefined ? { content: encryptSecret(content) } : {}) })
      .where(eq(tables.appFiles.id, id))
  } catch {
    throw createError({ statusCode: 409, statusMessage: `${path} already exists` })
  }
  await touchProject(file.app.projectId)
  return { ok: true }
})
