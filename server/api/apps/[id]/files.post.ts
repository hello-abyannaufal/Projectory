import { eq, max } from 'drizzle-orm'

// Adds a file shared by every environment of the app, such as .vscode/launch.json.
export default defineEventHandler(async (event) => {
  const appId = getIdParam(event)
  const db = useDb()
  const app = await db.query.apps.findFirst({ where: eq(tables.apps.id, appId), columns: { projectId: true } })
  if (!app) {
    notFound()
  }
  const { path, content } = await readInput(event, appFileInput)
  const [last] = await db.select({ value: max(tables.appFiles.sortOrder) }).from(tables.appFiles).where(eq(tables.appFiles.appId, appId))
  try {
    const [file] = await db.insert(tables.appFiles)
      .values({ appId, path, content: encryptSecret(content), sortOrder: (last?.value ?? -1) + 1 })
      .returning({ id: tables.appFiles.id, path: tables.appFiles.path })
    await touchProject(app.projectId)
    return file
  } catch {
    throw createError({ statusCode: 409, statusMessage: `${path} already exists` })
  }
})
