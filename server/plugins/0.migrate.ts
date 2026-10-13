import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { seedTechStacks } from '../db/seed'

export default defineNitroPlugin(async () => {
  assertMasterKey()
  // On Vercel, migrations run once at build time (`pnpm db:migrate`); the
  // migrations folder isn't bundled into the function.
  if (!process.env.VERCEL) {
    await migrate(useDb(), { migrationsFolder: resolve('server/db/migrations') })
  }
  await seedTechStacks()
  await purgeExpiredTrash()
})
