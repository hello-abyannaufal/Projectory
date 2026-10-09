import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const stack = await findCustomStack(id)
  const logo = await saveImageUpload(event)
  await useDb().update(tables.techStacks).set({ logo }).where(eq(tables.techStacks.id, id))
  await deleteUpload(stack.logo)
  return { logo }
})
