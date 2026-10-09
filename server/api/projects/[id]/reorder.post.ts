import { and, eq } from 'drizzle-orm'
import * as z from 'zod'

const reorderInput = z.object({
  kind: z.enum(['environments', 'apps']),
  ids: z.array(z.uuid())
})

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  const { kind, ids } = await readInput(event, reorderInput)
  const table = kind === 'environments' ? tables.environments : tables.apps
  const db = useDb()
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(table).set({ sortOrder: index }).where(and(eq(table.id, id), eq(table.projectId, projectId)))
    }
  })
  await touchProject(projectId)
  return { ok: true }
})
