import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user as { id: string, image?: string | null }
  const name = await saveImageUpload(event)
  const image = uploadUrl(name)
  await useDb().update(tables.user).set({ image, updatedAt: new Date() }).where(eq(tables.user.id, user.id))
  if (user.image?.startsWith('/uploads/')) {
    await deleteUpload(user.image.slice('/uploads/'.length))
  }
  return { image }
})

function uploadUrl(name: string) {
  return `/uploads/${name}`
}
