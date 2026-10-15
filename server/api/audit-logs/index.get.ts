import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import * as z from 'zod'

const PAGE_SIZE = 50

const auditQuery = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1)
})

// Super user only (see server/middleware/auth.ts).
export default defineEventHandler(async (event) => {
  const { action, userId, q, page } = await getValidatedQuery(event, query => auditQuery.parse(query))
  const { auditLogs } = tables
  const filters: SQL[] = []
  if (action) {
    filters.push(eq(auditLogs.action, action))
  }
  if (userId) {
    filters.push(eq(auditLogs.userId, userId))
  }
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
    filters.push(or(ilike(auditLogs.target, pattern), ilike(auditLogs.userName, pattern))!)
  }
  const where = filters.length ? and(...filters) : undefined
  const db = useDb()
  const [items, [total], actors] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(auditLogs).where(where),
    db.selectDistinct({ id: auditLogs.userId, name: auditLogs.userName }).from(auditLogs)
  ])
  return { items, total: total?.value ?? 0, pageSize: PAGE_SIZE, actors: [...new Map(actors.filter(actor => actor.id).map(actor => [actor.id, actor])).values()] }
})
