import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const account = await findTestAccount(id)
  await useDb().delete(tables.testAccounts).where(eq(tables.testAccounts.id, id))
  await touchProject(account.deployment.app.projectId)
  return { ok: true }
})
