import { eq, max } from 'drizzle-orm'
import * as z from 'zod'

// Copies an account with its fields into the same deployment, or into another
// environment of the same app when `deploymentId` is sent. Secret values are
// copied as stored ciphertext, so nothing is decrypted here.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const source = await findTestAccount(id)
  assertNotProduction(source.deployment)
  const body = await readBody(event).catch(() => undefined)
  const { deploymentId = source.deploymentId } = z.object({ deploymentId: z.uuid().optional() }).parse(body ?? {})
  const sameDeployment = deploymentId === source.deploymentId
  const target = sameDeployment ? source.deployment : await findDeployment(deploymentId)
  if (target.appId !== source.deployment.appId) {
    throw createError({ statusCode: 400, statusMessage: 'Accounts can only be copied between environments of the same app' })
  }
  assertNotProduction(target)

  const db = useDb()
  const fields = await db.select().from(tables.testAccountFields)
    .where(eq(tables.testAccountFields.accountId, id))
  const [last] = await db.select({ value: max(tables.testAccounts.sortOrder) }).from(tables.testAccounts)
    .where(eq(tables.testAccounts.deploymentId, deploymentId))
  const [copy] = await db.insert(tables.testAccounts).values({
    deploymentId,
    label: sameDeployment ? `${source.label} (copy)` : source.label,
    description: source.description,
    tags: source.tags,
    status: source.status,
    sortOrder: (last?.value ?? -1) + 1
  }).returning()
  if (fields.length) {
    await db.insert(tables.testAccountFields).values(fields.map(field => ({
      accountId: copy!.id,
      key: field.key,
      value: field.value,
      isSecret: field.isSecret,
      sortOrder: field.sortOrder
    })))
  }
  await touchProject(source.deployment.app.projectId)
  return { id: copy!.id, deploymentId }
})
