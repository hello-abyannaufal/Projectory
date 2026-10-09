import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const rows = await useDb().query.projects.findMany({
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
      appCount: apps.length,
      environmentCount: environments.length,
      platforms: [...new Set(apps.flatMap(app => app.platforms))],
      techStacks: [...stacks.values()]
    }
  })
})
