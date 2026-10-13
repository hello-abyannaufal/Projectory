import { asc, desc, eq, isNull } from 'drizzle-orm'

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
      apps: {
        orderBy: [asc(tables.apps.sortOrder), asc(tables.apps.createdAt)],
        with: {
          links: { orderBy: asc(tables.links.sortOrder) },
          techStacks: { with: { techStack: true } },
          deployments: {
            columns: { notes: false },
            with: {
              testAccounts: { columns: { id: true } },
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

  return {
    ...project,
    apps: project.apps.map(({ techStacks, deployments, ...app }) => ({
      ...app,
      techStacks: techStacks.map(({ techStack }) => techStack),
      deployments: deployments.map(({ testAccounts, releases, ...deployment }) => ({
        ...deployment,
        accountCount: testAccounts.length,
        latestVersion: releases[0]?.version ?? null
      }))
    }))
  }
})
