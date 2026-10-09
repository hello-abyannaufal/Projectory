import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const account = await findTestAccount(id)
  assertNotProduction(account.deployment)
  const { fields, lastVerifiedAt, ...input } = await readInput(event, testAccountInput.partial())
  const values = {
    ...input,
    ...(lastVerifiedAt !== undefined ? { lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt) : null } : {})
  }
  if (Object.keys(values).length) {
    await useDb().update(tables.testAccounts).set(values).where(eq(tables.testAccounts.id, id))
  }
  if (fields) {
    await replaceAccountFields(id, fields)
  }
  await touchProject(account.deployment.app.projectId)
  return { id }
})
