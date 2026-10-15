import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'

// Secret values are never returned here; use the reveal endpoints.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const db = useDb()
  const deployment = await db.query.deployments.findFirst({
    where: eq(tables.deployments.id, id),
    with: {
      environment: true,
      app: {
        columns: { id: true, name: true, projectId: true },
        with: {
          project: {
            columns: { id: true, name: true },
            with: { group: { columns: { id: true, name: true } } }
          },
          deployments: {
            columns: { id: true },
            with: { environment: { columns: { name: true, isProduction: true, sortOrder: true } } }
          }
        }
      },
      releases: { orderBy: [desc(tables.releases.releasedAt), desc(tables.releases.createdAt)] },
      testAccounts: {
        orderBy: [asc(tables.testAccounts.sortOrder), asc(tables.testAccounts.createdAt)],
        with: { fields: { orderBy: asc(tables.testAccountFields.sortOrder) } }
      },
      envVars: {
        columns: { id: true, key: true },
        orderBy: [asc(tables.envVars.sortOrder), asc(tables.envVars.key)]
      }
    }
  })
  if (!deployment) {
    notFound()
  }

  // Infra of this environment plus items shared by every environment.
  const infraItems = await db.query.infraItems.findMany({
    where: and(
      eq(tables.infraItems.projectId, deployment.app.projectId),
      or(eq(tables.infraItems.environmentId, deployment.environmentId), isNull(tables.infraItems.environmentId))
    ),
    orderBy: asc(tables.infraItems.name)
  })

  // Links flagged with this environment, of this app or the whole project; category then name.
  const links = await db.query.links.findMany({
    where: and(
      eq(tables.links.projectId, deployment.app.projectId),
      eq(tables.links.environmentId, deployment.environmentId),
      or(eq(tables.links.appId, deployment.appId), isNull(tables.links.appId))
    ),
    orderBy: [asc(tables.links.type), asc(tables.links.label)]
  })

  const { app, testAccounts, ...rest } = deployment
  return {
    ...rest,
    infraItems,
    links,
    app: { id: app.id, name: app.name },
    project: app.project,
    siblings: app.deployments
      .map(sibling => ({ id: sibling.id, ...sibling.environment }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    testAccounts: testAccounts.map(account => ({
      ...account,
      fields: account.fields.map(({ value, ...field }) => ({
        ...field,
        value: field.isSecret ? null : value
      }))
    }))
  }
})
