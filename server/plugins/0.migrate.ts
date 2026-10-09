import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { seedTechStacks } from '../db/seed'

export default defineNitroPlugin(async () => {
  assertMasterKey()
  await migrate(useDb(), { migrationsFolder: resolve('server/db/migrations') })
  await seedTechStacks()
})
