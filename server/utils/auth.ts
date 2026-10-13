import { eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import type { H3Event } from 'h3'

let auth: ReturnType<typeof createAuth> | undefined

// Better Auth endpoints that are written to the audit log.
const AUTH_AUDIT_ACTIONS: Record<string, AuditAction> = {
  '/sign-in/email': 'user.sign_in',
  '/admin/create-user': 'user.create',
  '/admin/set-role': 'user.role_change',
  '/admin/set-user-password': 'user.password_reset'
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
        verification: tables.verification
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
      admin({ ac: authAccessControl, roles: authRoles, adminRoles: ['super_user'], defaultRole: 'viewer' })
    ],
    hooks: {
      // A super user can't demote themselves, so the instance always keeps one.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/admin/set-role' && ctx.path !== '/admin/update-user') {
          return
        }
        const session = await getSessionFromCtx(ctx)
        if (session && ctx.body?.userId === session.user.id) {
          throw new APIError('BAD_REQUEST', { message: 'You cannot change your own role.' })
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const action = AUTH_AUDIT_ACTIONS[ctx.path]
        if (!action || ctx.context.returned instanceof APIError) {
          return
        }
        const ipAddress = forwardedIp(ctx.headers)
        if (action === 'user.sign_in') {
          const user = ctx.context.newSession?.user
          if (user) {
            await writeAuditLog(user, { action, target: user.email }, ipAddress)
          }
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
    },
    databaseHooks: {
      user: {
        create: {
          // The setup page creates the first account, which becomes the super user.
          // After that, accounts are only created by a super user.
          before: async (user, ctx) => {
            if (!await hasUser()) {
              return { data: { ...user, role: 'super_user' } }
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
