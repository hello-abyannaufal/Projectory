import { asc, eq, isNotNull, notInArray, sql } from 'drizzle-orm'

// Private groups of other users are left out: they don't exist as far as the caller can tell.
export default defineEventHandler(async (event) => {
  const { groups, projects } = tables
  const hidden = [...await hiddenGroupIds(event)]
  const rows = await useDb()
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      hasAccessCode: isNotNull(groups.accessCode),
      isPrivate: isNotNull(groups.ownerId),
      projectCount: sql<number>`count(${projects.id}) filter (where ${projects.deletedAt} is null)`.mapWith(Number),
      // Projects in the trash still block deleting the group.
      vpnCount: sql<number>`(select count(*) from ${tables.groupVpns} where ${tables.groupVpns.groupId} = ${groups.id})`.mapWith(Number),
      trashedCount: sql<number>`count(${projects.id}) filter (where ${projects.deletedAt} is not null)`.mapWith(Number)
    })
    .from(groups)
    .leftJoin(projects, eq(projects.groupId, groups.id))
    .where(hidden.length ? notInArray(groups.id, hidden) : undefined)
    .groupBy(groups.id)
    .orderBy(asc(groups.name))
  const locked = await lockedGroupIds(event)
  return rows.map(group => ({ ...group, locked: locked.has(group.id) }))
})
