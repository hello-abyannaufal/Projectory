import { STALE_ACCOUNT_DAYS, type TestAccountStatus } from './constants'

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
