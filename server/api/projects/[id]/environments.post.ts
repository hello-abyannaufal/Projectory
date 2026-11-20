import { eq, max } from 'drizzle-orm'
import * as z from 'zod'

const createInput = environmentInput.extend({ vpnIds: z.array(z.uuid()).optional() })

export default defineEventHandler(async (event) => {
  const projectId = getIdParam(event)
  await requireProject(projectId)
  const { vpnIds, ...input } = await readInput(event, createInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.environments.sortOrder) }).from(tables.environments).where(eq(tables.environments.projectId, projectId))
  const [environment] = await db.insert(tables.environments)
    .values({ ...input, projectId, sortOrder: (last?.value ?? -1) + 1 })
    .returning()
  if (vpnIds?.length) {
    await setEnvironmentVpns(environment!.id, projectId, vpnIds)
  }
  await touchProject(projectId)
  return environment
})
