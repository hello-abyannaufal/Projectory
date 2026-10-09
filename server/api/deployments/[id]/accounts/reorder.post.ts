import { and, eq } from 'drizzle-orm'
import * as z from 'zod'

const reorderInput = z.object({
  ids: z.array(z.uuid())
})

export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  const { ids } = await readInput(event, reorderInput)
  const db = useDb()
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(tables.testAccounts).set({ sortOrder: index }).where(and(eq(tables.testAccounts.id, id), eq(tables.testAccounts.deploymentId, deploymentId)))
    }
  })
  await touchProject(deployment.app.projectId)
  return { ok: true }
})
