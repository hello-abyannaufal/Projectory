import { asc, eq } from 'drizzle-orm'

// Paths only; the content comes from /api/app-files/:id/reveal.
export default defineEventHandler(async (event) => {
  const appId = getIdParam(event)
  return useDb().select({ id: tables.appFiles.id, path: tables.appFiles.path, updatedAt: tables.appFiles.updatedAt })
    .from(tables.appFiles)
    .where(eq(tables.appFiles.appId, appId))
    .orderBy(asc(tables.appFiles.sortOrder), asc(tables.appFiles.path))
})
