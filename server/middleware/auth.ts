// Every API route requires a signed-in user, except auth and setup status.
const PUBLIC_PREFIXES = ['/api/auth/', '/api/setup', '/api/_nuxt_icon']

export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/') && !path.startsWith('/uploads/')) {
    return
  }
  if (PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  event.context.user = user
})
