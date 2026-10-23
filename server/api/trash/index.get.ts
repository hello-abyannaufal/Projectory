import { and, desc, isNotNull, notInArray } from 'drizzle-orm'

// Projects in the trash, except those in groups this session hasn't unlocked.
export default defineEventHandler(async (event) => {
  await purgeExpiredTrash()
  const locked = [...await lockedGroupIds(event)]
  const rows = await useDb().query.projects.findMany({
    where: and(isNotNull(tables.projects.deletedAt), locked.length ? notInArray(tables.projects.groupId, locked) : undefined),
    orderBy: desc(tables.projects.deletedAt),
    columns: { id: true, name: true, description: true, cover: true, deletedAt: true, deletedBy: true },
    with: { group: { columns: { id: true, name: true } } }
  })
  const retention = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return rows.map(row => ({ ...row, purgeAt: new Date(row.deletedAt!.getTime() + retention) }))
})
