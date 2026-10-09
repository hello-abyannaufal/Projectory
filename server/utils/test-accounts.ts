import { eq } from 'drizzle-orm'
import type * as z from 'zod'

type FieldInput = z.output<typeof testAccountFieldInput>
type StoredField = { id: string, value: string, isSecret: boolean }

// Builds field rows for an account. Secret values are encrypted; a secret
// field sent with value null keeps the value it already has.
function buildFields(accountId: string, fields: FieldInput[], existing: StoredField[] = []) {
  const byId = new Map(existing.map(field => [field.id, field]))
  return fields.map((field, index) => {
    const previous = field.id ? byId.get(field.id) : undefined
    let value: string
    if (field.isSecret) {
      value = field.value === null
        ? (previous?.isSecret ? previous.value : '')
        : encryptSecret(field.value)
    } else {
      value = field.value ?? (previous && !previous.isSecret ? previous.value : '')
    }
    return { accountId, key: field.key, value, isSecret: field.isSecret, sortOrder: index }
  })
}

export async function replaceAccountFields(accountId: string, fields: FieldInput[]) {
  const db = useDb()
  const existing = await db.select().from(tables.testAccountFields).where(eq(tables.testAccountFields.accountId, accountId))
  const rows = buildFields(accountId, fields, existing)
  await db.delete(tables.testAccountFields).where(eq(tables.testAccountFields.accountId, accountId))
  if (rows.length) {
    await db.insert(tables.testAccountFields).values(rows)
  }
}

export async function findTestAccount(id: string) {
  const account = await useDb().query.testAccounts.findFirst({
    where: eq(tables.testAccounts.id, id),
    with: { deployment: { with: { app: { columns: { projectId: true } }, environment: { columns: { isProduction: true } } } } }
  })
  if (!account) {
    notFound()
  }
  return account
}
