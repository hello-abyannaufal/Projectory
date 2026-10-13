import { desc, eq, notInArray } from 'drizzle-orm'

// Projects in groups this session hasn't unlocked are left out.
export default defineEventHandler(async (event) => {
  const locked = [...await lockedGroupIds(event)]
  const userId = (event.context.user as { id: string }).id
  const db = useDb()
  const [pins, visits] = await Promise.all([
    db.select().from(tables.projectPins).where(eq(tables.projectPins.userId, userId)),
    db.select().from(tables.projectVisits).where(eq(tables.projectVisits.userId, userId))
  ])
  const pinnedAt = new Map(pins.map(pin => [pin.projectId, pin.createdAt]))
  const visitedAt = new Map(visits.map(visit => [visit.projectId, visit.visitedAt]))
  const rows = await db.query.projects.findMany({
    where: locked.length ? notInArray(tables.projects.groupId, locked) : undefined,
    orderBy: desc(tables.projects.updatedAt),
    columns: { notes: false },
    with: {
      environments: { columns: { id: true } },
      apps: {
        columns: { platforms: true },
        with: { techStacks: { with: { techStack: true } } }
      }
    }
  })

  return rows.map(({ environments, apps, ...project }) => {
    const stacks = new Map(apps.flatMap(app => app.techStacks.map(({ techStack }) => [techStack.id, techStack])))
    return {
      ...project,
      pinnedAt: pinnedAt.get(project.id) ?? null,
      visitedAt: visitedAt.get(project.id) ?? null,
      appCount: apps.length,
      environmentCount: environments.length,
      platforms: [...new Set(apps.flatMap(app => app.platforms))],
      techStacks: [...stacks.values()]
    }
  })
})
