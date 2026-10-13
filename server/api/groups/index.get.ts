import { asc, eq, isNotNull, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { groups, projects } = tables
  const rows = await useDb()
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      hasAccessCode: isNotNull(groups.accessCode),
      projectCount: sql<number>`count(${projects.id}) filter (where ${projects.deletedAt} is null)`.mapWith(Number),
      // Projects in the trash still block deleting the group.
      trashedCount: sql<number>`count(${projects.id}) filter (where ${projects.deletedAt} is not null)`.mapWith(Number)
    })
    .from(groups)
    .leftJoin(projects, eq(projects.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name))
  const locked = await lockedGroupIds(event)
  return rows.map(group => ({ ...group, locked: locked.has(group.id) }))
})
