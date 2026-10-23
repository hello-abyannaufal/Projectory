import { and, asc, desc, eq, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const project = await useDb().query.projects.findFirst({
    where: eq(tables.projects.id, id),
    with: {
      group: { columns: { id: true, name: true } },
      links: {
        where: isNull(tables.links.appId),
        orderBy: asc(tables.links.sortOrder)
      },
      environments: {
        orderBy: [asc(tables.environments.sortOrder), asc(tables.environments.createdAt)]
      },
      infraItems: {
        orderBy: [asc(tables.infraItems.name)]
      },
      apps: {
        orderBy: [asc(tables.apps.sortOrder), asc(tables.apps.createdAt)],
        with: {
          links: { orderBy: asc(tables.links.sortOrder) },
          techStacks: { with: { techStack: true } },
          deployments: {
            columns: { notes: false },
            with: {
              testAccounts: { columns: { status: true, lastVerifiedAt: true } },
              releases: {
                columns: { version: true },
                orderBy: desc(tables.releases.createdAt),
                limit: 1
              }
            }
          }
        }
      }
    }
  })
  if (!project) {
    notFound()
  }

  const userId = (event.context.user as { id: string }).id
  const visitedAt = new Date()
  const [, pin] = await Promise.all([
    useDb().insert(tables.projectVisits).values({ userId, projectId: id, visitedAt })
      .onConflictDoUpdate({ target: [tables.projectVisits.userId, tables.projectVisits.projectId], set: { visitedAt } }),
    useDb().query.projectPins.findFirst({ where: and(eq(tables.projectPins.userId, userId), eq(tables.projectPins.projectId, id)) })
  ])

  return {
    ...project,
    pinned: !!pin,
    apps: project.apps.map(({ techStacks, deployments, ...app }) => ({
      ...app,
      techStacks: techStacks.map(({ techStack }) => techStack),
      deployments: deployments.map(({ testAccounts, releases, ...deployment }) => ({
        ...deployment,
        accountCount: testAccounts.length,
        attentionCount: testAccounts.filter(account => accountAttention(account)).length,
        latestVersion: releases[0]?.version ?? null
      }))
    }))
  }
})
