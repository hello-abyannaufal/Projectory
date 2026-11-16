import { SECRET_MASK, STALE_ACCOUNT_DAYS, type TestAccountStatus } from './constants'

// Why a test account needs a look, or null when it's fine: locked or expired,
// or active but not verified in STALE_ACCOUNT_DAYS.
export function accountAttention(account: { status: TestAccountStatus, lastVerifiedAt: string | Date | null }) {
  if (account.status !== 'active') {
    return account.status
  }
  const staleBefore = Date.now() - STALE_ACCOUNT_DAYS * 24 * 60 * 60 * 1000
  if (!account.lastVerifiedAt || new Date(account.lastVerifiedAt).getTime() < staleBefore) {
    return 'stale'
  }
  return null
}

export interface ExportableAccount {
  label: string
  description?: string | null
  tags: string[]
  status: string
  lastVerifiedAt: string | Date | null
  fields: { id: string, key: string, value: string | null, isSecret: boolean }[]
}

// Revealed secret values by field id; without them secret fields stay masked.
type Secrets = Record<string, string> | undefined

// Lines for sharing one account as text.
export function accountTextLines(account: ExportableAccount, secrets?: Secrets) {
  return [
    `Account: ${account.label}${account.tags.length ? ` (${account.tags.join(', ')})` : ''}`,
    ...account.fields.map(field => `  ${field.key}: ${field.isSecret ? (secrets?.[field.id] ?? SECRET_MASK) : field.value}`)
  ]
}

// Same shape as the accounts of a project export; secrets are empty unless revealed.
export function accountsJson(context: { app: string, environment: string }, items: { account: ExportableAccount, secrets?: Secrets }[]) {
  return JSON.stringify({
    app: context.app,
    environment: context.environment,
    accounts: items.map(({ account, secrets }) => ({
      label: account.label,
      description: account.description ?? null,
      tags: account.tags,
      status: account.status,
      lastVerifiedAt: account.lastVerifiedAt ? new Date(account.lastVerifiedAt).toISOString() : null,
      fields: account.fields.map(field => ({
        key: field.key,
        isSecret: field.isSecret,
        value: field.isSecret ? (secrets?.[field.id] ?? '') : field.value
      }))
    }))
  }, null, 2)
}
