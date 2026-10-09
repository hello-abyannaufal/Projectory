import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const input = await readInput(event, releaseInput.partial())
  const [release] = await useDb().update(tables.releases).set(input).where(eq(tables.releases.id, id)).returning()
  if (!release) {
    notFound()
  }
  return release
})
