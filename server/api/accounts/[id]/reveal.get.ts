import { and, eq } from 'drizzle-orm'

// Returns decrypted secret values as { [fieldId]: value }.
export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const account = await findTestAccount(id)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const fields = await useDb().select().from(tables.testAccountFields)
    .where(and(eq(tables.testAccountFields.accountId, id), eq(tables.testAccountFields.isSecret, true)))
  const { projectId, target } = await describeDeployment(account.deploymentId)
  await logAudit(event, { action: 'account.reveal', projectId, target: `${target} / ${account.label}` })
  return Object.fromEntries(fields.map(field => [field.id, field.value ? decryptSecret(field.value) : '']))
})
