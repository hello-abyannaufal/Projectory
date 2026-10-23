import { eq } from 'drizzle-orm'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { admin, twoFactor } from 'better-auth/plugins'
import type { H3Event } from 'h3'

let auth: ReturnType<typeof createAuth> | undefined

// Better Auth endpoints that are written to the audit log. A sign-in counts
// once its session exists, which for a two-factor account is after the code.
const AUTH_AUDIT_ACTIONS: Record<string, AuditAction> = {
  '/sign-in/email': 'user.sign_in',
  '/two-factor/verify-totp': 'user.sign_in',
  '/two-factor/verify-backup-code': 'user.sign_in',
  '/admin/create-user': 'user.create',
  '/admin/set-role': 'user.role_change',
  '/admin/set-user-password': 'user.password_reset'
}

// What a signed-in account may still do before it has set up two-factor.
const TWO_FACTOR_SETUP_PATHS = new Set([
  '/get-session',
  '/sign-out',
  '/sign-in/email',
  '/two-factor/enable',
  '/two-factor/get-totp-uri',
  '/two-factor/verify-totp'
])

const TWO_FACTOR_TRUST_SECONDS = TWO_FACTOR_TRUST_DAYS * 24 * 60 * 60

// When this browser last passed a two-factor code. Never renewed, unlike the
// plugin's trust_device cookie.
const TWO_FACTOR_AT_COOKIE = 'two_factor_at'

type AuthContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

function signedCookie(ctx: AuthContext, name: string) {
  return ctx.getSignedCookie(ctx.context.createAuthCookie(name).name, ctx.context.secret)
}

// A sign-in waiting for its second step carries the plugin's two_factor cookie;
// verifying a code without it confirms the authenticator during setup.
async function isPendingSignIn(ctx: AuthContext) {
  return !!await signedCookie(ctx, 'two_factor')
}

// The two-factor plugin renews a trusted browser on every sign-in, so one used
// daily would never be asked for a code again. This drops the trust once
// TWO_FACTOR_TRUST_DAYS have passed since the last code, before the plugin
// checks it, so the sign-in asks for a code.
function twoFactorExpiry() {
  return {
    id: 'two-factor-expiry',
    hooks: {
      before: [{
        matcher: ctx => ctx.path === '/sign-in/email',
        handler: createAuthMiddleware(async (ctx) => {
          const trust = await signedCookie(ctx, 'trust_device')
          const trustId = trust ? trust.split('!')[1] : undefined
          if (!trustId) {
            return
          }
          const verifiedAt = Number(await signedCookie(ctx, TWO_FACTOR_AT_COOKIE))
          if (!(Date.now() - verifiedAt < TWO_FACTOR_TRUST_SECONDS * 1000)) {
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(trustId)
          }
        })
      }],
      after: [{
        matcher: ctx => ctx.path === '/two-factor/verify-totp' || ctx.path === '/two-factor/verify-backup-code',
        handler: createAuthMiddleware(async (ctx) => {
          if (!ctx.context.newSession || !ctx.body?.trustDevice || !await isPendingSignIn(ctx)) {
            return
          }
          const cookie = ctx.context.createAuthCookie(TWO_FACTOR_AT_COOKIE, { maxAge: TWO_FACTOR_TRUST_SECONDS })
          await ctx.setSignedCookie(cookie.name, String(Date.now()), ctx.context.secret, cookie.attributes)
        })
      }]
    }
  } satisfies BetterAuthPlugin
}

// Listed after the two-factor plugin so its hooks see the outcome: a password
// sign-in that still needs a code has no session yet.
function auditTrail() {
  return {
    id: 'audit-trail',
    hooks: {
      after: [{
        matcher: ctx => !!ctx.path && ctx.path in AUTH_AUDIT_ACTIONS,
        handler: createAuthMiddleware(async (ctx) => {
          const action = AUTH_AUDIT_ACTIONS[ctx.path]!
          if (ctx.context.returned instanceof APIError) {
            return
          }
          const ipAddress = forwardedIp(ctx.headers)
          if (action === 'user.sign_in') {
            const user = ctx.context.newSession?.user
            if (!user) {
              return
            }
            const setup = ctx.path === '/two-factor/verify-totp' && !await isPendingSignIn(ctx)
            await writeAuditLog(user, { action: setup ? 'user.two_factor_enable' : action, target: user.email }, ipAddress)
            return
          }
          const session = await getSessionFromCtx(ctx)
          if (!session) {
            return
          }
          const target = action === 'user.create'
            ? ctx.body?.email
            : (await userEmail(ctx.body?.userId)) ?? ctx.body?.userId
          await writeAuditLog(session.user, { action, target, metadata: ctx.body?.role ? { role: ctx.body.role } : undefined }, ipAddress)
        })
      }]
    }
  } satisfies BetterAuthPlugin
}

// Admin endpoints act on body.userId and may hand out a role. The target and
// the new role must both be ones the signed-in user may manage (see
// canManageRole). Your own account is changed in Settings, never here, so the
// master can't demote or remove themselves either.
async function assertCanManage(actor: { id: string, role?: string | null }, body: { userId?: unknown, role?: unknown, data?: { role?: unknown } } | undefined) {
  const forbidden = (message: string) => new APIError('FORBIDDEN', { message })
  const userId = body?.userId
  if (typeof userId === 'string') {
    if (userId === actor.id) {
      throw forbidden('You cannot change your own account here.')
    }
    const target = await useDb().query.user.findFirst({ where: eq(tables.user.id, userId), columns: { role: true } })
    if (target && !canManageRole(actor.role, target.role)) {
      throw forbidden('You cannot manage this user.')
    }
  }
  const role = body?.role ?? body?.data?.role
  const roles = role === undefined ? [] : [role].flat()
  if (roles.some(value => typeof value !== 'string' || !canManageRole(actor.role, value))) {
    throw forbidden('You cannot give this role.')
  }
}

async function userEmail(id: unknown) {
  if (typeof id !== 'string') {
    return undefined
  }
  const row = await useDb().query.user.findFirst({ where: eq(tables.user.id, id), columns: { email: true } })
  return row?.email
}

// Better Auth hooks get no H3 event, so the IP comes from the proxy header only.
function forwardedIp(headers: Headers | undefined) {
  return headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
}

function createAuth() {
  const db = useDb()
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: tables.user,
        session: tables.session,
        account: tables.account,
        verification: tables.verification,
        twoFactor: tables.twoFactor
      }
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8
    },
    user: {
      // No mail server: users can change their email directly.
      changeEmail: { enabled: true, updateEmailWithoutVerification: true }
    },
    plugins: [
      admin({ ac: authAccessControl, roles: authRoles, adminRoles: ['master', 'super_user'], defaultRole: 'viewer' }),
      twoFactor({ issuer: 'Projectory', trustDeviceMaxAge: TWO_FACTOR_TRUST_SECONDS }),
      twoFactorExpiry(),
      auditTrail()
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Two-factor is required for every account, so it can't be turned off.
        if (ctx.path === '/two-factor/disable') {
          throw new APIError('FORBIDDEN', { message: 'Two-factor authentication is required.' })
        }
        // Signing in as someone else skips their two-factor and puts your actions
        // under their name in the audit log.
        if (ctx.path === '/admin/impersonate-user') {
          throw new APIError('FORBIDDEN', { message: 'Impersonation is disabled.' })
        }
        const session = TWO_FACTOR_SETUP_PATHS.has(ctx.path) ? null : await getSessionFromCtx(ctx)
        if (session && !session.user.twoFactorEnabled) {
          throw new APIError('FORBIDDEN', { message: 'Set up two-factor authentication first.', code: 'TWO_FACTOR_REQUIRED' })
        }
        if (session && ctx.path.startsWith('/admin/')) {
          await assertCanManage(session.user, ctx.body)
        }
        // Only the master sees the master account in the user list.
        if (ctx.path === '/admin/list-users' && session && session.user.role !== 'master') {
          return { context: { query: { ...ctx.query, filterField: 'role', filterOperator: 'ne', filterValue: 'master' } } }
        }
      })
    },
    databaseHooks: {
      user: {
        create: {
          // The setup page creates the first account, which becomes the master.
          // After that, accounts are only created by the master or a super user.
          before: async (user, ctx) => {
            if (!await hasUser()) {
              return { data: { ...user, role: 'master' } }
            }
            if (ctx?.path !== '/admin/create-user') {
              throw new APIError('FORBIDDEN', { message: 'Sign up is closed. Ask a super user for an account.' })
            }
          }
        },
        // Logged here rather than in the after hook, which no longer sees the user.
        delete: {
          after: async (user, ctx) => {
            const session = ctx && await getSessionFromCtx(ctx)
            if (session) {
              await writeAuditLog(session.user, { action: 'user.delete', target: user.email }, forwardedIp(ctx.headers))
            }
          }
        }
      }
    }
  })
}

export function useServerAuth() {
  auth ??= createAuth()
  return auth
}

export async function hasUser() {
  const row = await useDb().select({ id: tables.user.id }).from(tables.user).limit(1)
  return row.length > 0
}

export function getAuthSession(event: H3Event) {
  return useServerAuth().api.getSession({ headers: event.headers })
}
