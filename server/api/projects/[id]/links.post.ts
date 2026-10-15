import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const input = await readInput(event, linkInput)
  const db = useDb()
  if (input.appId) {
    const app = await db.query.apps.findFirst({ where: and(eq(tables.apps.id, input.appId), eq(tables.apps.projectId, projectId)) })
    if (!app) {
      notFound()
    }
  }
  await assertProjectEnvironment(projectId, input.environmentId)
  const [link] = await db.insert(tables.links).values({ ...input, projectId }).returning()
  await touchProject(projectId)
  return link
})
