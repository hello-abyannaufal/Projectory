import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const stack = await findCustomStack(id)
  const db = useDb()
  const used = await db.query.appTechStacks.findFirst({ where: eq(tables.appTechStacks.techStackId, id) })
  if (used) {
    throw createError({ statusCode: 409, statusMessage: 'This stack is still used by an app' })
  }
  await db.delete(tables.techStacks).where(eq(tables.techStacks.id, id))
  await deleteUpload(stack.logo)
  return { ok: true }
})
