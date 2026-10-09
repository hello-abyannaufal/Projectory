import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
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
      // No mail server: the single local user can change their email directly.
      changeEmail: { enabled: true, updateEmailWithoutVerification: true }
    },
    databaseHooks: {
      user: {
        create: {
          // Single-user instance: only the first account can ever be created.
          before: async () => {
            if (await hasUser()) {
              throw new APIError('FORBIDDEN', { message: 'This instance already has an account.' })
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

export async function getSessionUser(event: H3Event) {
  const session = await useServerAuth().api.getSession({ headers: event.headers })
  return session?.user ?? null
}
