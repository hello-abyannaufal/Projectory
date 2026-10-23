import { and, eq, isNotNull, lt } from 'drizzle-orm'

// Permanently deletes a project in the trash, with its cover.
export async function purgeProject(id: string) {
  const [project] = await useDb().delete(tables.projects)
    .where(and(eq(tables.projects.id, id), isNotNull(tables.projects.deletedAt)))
    .returning()
  if (project) {
    await deleteUpload(project.cover)
  }
  return project
}

// Runs whenever the trash is listed and on server start, so no scheduler is needed.
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const expired = await useDb().select({ id: tables.projects.id }).from(tables.projects)
    .where(lt(tables.projects.deletedAt, cutoff))
  for (const { id } of expired) {
    await purgeProject(id)
  }
}
