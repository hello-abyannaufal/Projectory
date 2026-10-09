import { eq } from 'drizzle-orm'

// Built-in stacks come from Simple Icons and are read-only.
export async function findCustomStack(id: string) {
  const stack = await useDb().query.techStacks.findFirst({ where: eq(tables.techStacks.id, id) })
  if (!stack) {
    notFound()
  }
  if (!stack.isCustom) {
    throw createError({ statusCode: 403, statusMessage: 'Built-in stacks cannot be changed' })
  }
  return stack
}
