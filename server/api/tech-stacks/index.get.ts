import { asc, eq, notInArray, sql } from 'drizzle-orm'

// Apps in other users' private groups are not counted.
export default defineEventHandler(async (event) => {
  const db = useDb()
  const hidden = [...await hiddenGroupIds(event)]
  return db
    .select({
      id: tables.techStacks.id,
      name: tables.techStacks.name,
      slug: tables.techStacks.slug,
      category: tables.techStacks.category,
      color: tables.techStacks.color,
      simpleIcon: tables.techStacks.simpleIcon,
      logo: tables.techStacks.logo,
      isCustom: tables.techStacks.isCustom,
      appCount: (hidden.length
        ? sql<number>`count(${tables.appTechStacks.appId}) filter (where ${notInArray(tables.projects.groupId, hidden)})`
        : sql<number>`count(${tables.appTechStacks.appId})`).mapWith(Number)
    })
    .from(tables.techStacks)
    .leftJoin(tables.appTechStacks, eq(tables.appTechStacks.techStackId, tables.techStacks.id))
    .leftJoin(tables.apps, eq(tables.apps.id, tables.appTechStacks.appId))
    .leftJoin(tables.projects, eq(tables.projects.id, tables.apps.projectId))
    .groupBy(tables.techStacks.id)
    .orderBy(asc(tables.techStacks.name))
})
