import { eq } from 'drizzle-orm'
import * as z from 'zod'

const patchInput = environmentInput.partial().extend({ vpnIds: z.array(z.uuid()).optional() })

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const { vpnIds, ...input } = await readPatch(event, patchInput)
  const db = useDb()
  const existing = await db.query.environments.findFirst({ where: eq(tables.environments.id, id), columns: { projectId: true } })
  if (!existing) {
    notFound()
  }
  if (vpnIds) {
    await setEnvironmentVpns(id, existing.projectId, vpnIds)
  }
  const [environment] = Object.keys(input).length
    ? await db.update(tables.environments).set(input).where(eq(tables.environments.id, id)).returning()
    : await db.select().from(tables.environments).where(eq(tables.environments.id, id))
  await touchProject(existing.projectId)
  return environment
})
