import { asc, count, eq, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { groups, projects } = tables
  const rows = await useDb()
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      hasAccessCode: isNotNull(groups.accessCode),
      projectCount: count(projects.id)
    })
    .from(groups)
    .leftJoin(projects, eq(projects.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name))
  const locked = await lockedGroupIds(event)
  return rows.map(group => ({ ...group, locked: locked.has(group.id) }))
})
