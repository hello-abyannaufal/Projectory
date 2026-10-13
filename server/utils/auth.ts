import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { admin } from 'better-auth/plugins'
import type { H3Event } from 'h3'

let auth: ReturnType<typeof createAuth> | undefined

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
