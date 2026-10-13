import { eq } from 'drizzle-orm'
import * as z from 'zod'

const createInput = z.object({
  appId: z.uuid(),
  environmentId: z.uuid()
})

export default defineEventHandler(async (event) => {
  const { appId, environmentId } = await readInput(event, createInput)
  const db = useDb()
  const app = await db.query.apps.findFirst({ where: eq(tables.apps.id, appId), columns: { projectId: true }, with: { project: { columns: { groupId: true } } } })
  const environment = await db.query.environments.findFirst({ where: eq(tables.environments.id, environmentId), columns: { projectId: true } })
  if (!app || !environment || app.projectId !== environment.projectId) {
    notFound()
  }
  await assertGroupOpen(event, app.project.groupId)
  const [deployment] = await db.insert(tables.deployments)
    .values({ appId, environmentId })
    .onConflictDoUpdate({ target: [tables.deployments.appId, tables.deployments.environmentId], set: { appId } })
    .returning()
  await touchProject(app.projectId)
  return deployment
})
