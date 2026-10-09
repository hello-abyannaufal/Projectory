import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, linkInput.partial())
  const db = useDb()
  const existing = await db.query.links.findFirst({ where: eq(tables.links.id, id) })
  if (!existing) {
    notFound()
  }
  if (input.appId) {
    const app = await db.query.apps.findFirst({ where: and(eq(tables.apps.id, input.appId), eq(tables.apps.projectId, existing.projectId)) })
    if (!app) {
      notFound()
    }
  }
  const [link] = await db.update(tables.links).set(input).where(eq(tables.links.id, id)).returning()
  await touchProject(existing.projectId)
  return link
})
