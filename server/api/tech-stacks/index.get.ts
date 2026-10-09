import { asc, count, eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const db = useDb()
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
      appCount: count(tables.appTechStacks.appId)
    })
    .from(tables.techStacks)
    .leftJoin(tables.appTechStacks, eq(tables.appTechStacks.techStackId, tables.techStacks.id))
    .groupBy(tables.techStacks.id)
    .orderBy(asc(tables.techStacks.name))
})
