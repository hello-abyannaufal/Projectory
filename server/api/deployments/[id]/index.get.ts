import { asc, desc, eq } from 'drizzle-orm'

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
          project: { columns: { id: true, name: true } },
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

  const { app, testAccounts, ...rest } = deployment
  return {
    ...rest,
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
