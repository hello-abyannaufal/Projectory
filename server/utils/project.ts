import { eq, inArray } from 'drizzle-orm'

// Bumps the project's updatedAt so "updated x ago" reflects changes to its children.
export async function touchProject(projectId: string) {
  await useDb().update(tables.projects).set({ updatedAt: new Date() }).where(eq(tables.projects.id, projectId))
}

export async function requireProject(projectId: string) {
  const project = await useDb().query.projects.findFirst({ where: eq(tables.projects.id, projectId), columns: { id: true } })
  if (!project) {
    notFound()
  }
  return project
}

export async function requireGroup(groupId: string) {
  const group = await useDb().query.groups.findFirst({ where: eq(tables.groups.id, groupId), columns: { id: true } })
  if (!group) {
    throw createError({ statusCode: 400, statusMessage: 'Group not found' })
  }
  return group
}

export async function findDeployment(id: string) {
  const deployment = await useDb().query.deployments.findFirst({
    where: eq(tables.deployments.id, id),
    with: {
      app: { columns: { id: true, projectId: true } },
      environment: { columns: { isProduction: true } }
    }
  })
  if (!deployment) {
    notFound()
  }
  return deployment
}

// Production deployments never store credentials or .env values.
export function assertNotProduction(deployment: { environment: { isProduction: boolean } }) {
  if (deployment.environment.isProduction) {
    throw createError({ statusCode: 400, statusMessage: 'Production environments do not store credentials' })
  }
}

export async function setAppTechStacks(appId: string, techStackIds: string[]) {
  const db = useDb()
  await db.delete(tables.appTechStacks).where(eq(tables.appTechStacks.appId, appId))
  if (techStackIds.length) {
    const existing = await db.select({ id: tables.techStacks.id }).from(tables.techStacks).where(inArray(tables.techStacks.id, techStackIds))
    if (existing.length) {
      await db.insert(tables.appTechStacks).values(existing.map(({ id }) => ({ appId, techStackId: id })))
    }
  }
}
