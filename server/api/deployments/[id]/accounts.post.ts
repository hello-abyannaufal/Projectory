import { eq, max } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const deploymentId = getIdParam(event)
  const deployment = await findDeployment(deploymentId)
  assertNotProduction(deployment)
  const { fields, lastVerifiedAt, ...input } = await readInput(event, testAccountInput)
  const db = useDb()
  const [last] = await db.select({ value: max(tables.testAccounts.sortOrder) }).from(tables.testAccounts).where(eq(tables.testAccounts.deploymentId, deploymentId))
  const [account] = await db.insert(tables.testAccounts).values({
    ...input,
    deploymentId,
    lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt) : null,
    sortOrder: (last?.value ?? -1) + 1
  }).returning()
  await replaceAccountFields(account!.id, fields)
  await touchProject(deployment.app.projectId)
  return { id: account!.id }
})
