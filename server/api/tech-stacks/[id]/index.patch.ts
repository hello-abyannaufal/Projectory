import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  await findCustomStack(id)
  const input = await readPatch(event, techStackInput.partial())
  const [stack] = await useDb().update(tables.techStacks).set(input).where(eq(tables.techStacks.id, id)).returning()
  return stack
})
