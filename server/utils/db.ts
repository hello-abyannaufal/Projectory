import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

export const tables = schema

let db: ReturnType<typeof createDb> | undefined

function createDb() {
  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    throw new Error('NUXT_DATABASE_URL is not set')
  }
  return drizzle(postgres(databaseUrl, { onnotice: () => {} }), { schema })
}

export function useDb() {
  db ??= createDb()
  return db
}
