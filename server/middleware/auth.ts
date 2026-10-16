// Every API route requires a signed-in user, except auth and setup status.
const PUBLIC_PREFIXES = ['/api/auth/', '/api/setup', '/api/_nuxt_icon']

// Which permission a request needs, by path and method. Reads are open to every role
// except secret reveals; export checks secrets itself since a viewer may export without them.
// Pins are personal, so every role may set them.
function requiredPermission(path: string, method: string): Permission | undefined {
  if (path.startsWith('/api/groups')) {
    // Anyone may list groups and enter an access code; the rest is for the super user.
    const open = (method === 'GET' && path === '/api/groups') || /^\/api\/groups\/[^/]+\/unlock$/.test(path)
    return open ? undefined : 'manageGroups'
  }
  if (path.startsWith('/api/users')) {
    return 'manageUsers'
  }
  if (path.startsWith('/api/audit-logs')) {
    return 'viewAuditLog'
  }
  if (path.startsWith('/api/trash')) {
    return 'edit'
  }
  if (path.endsWith('/reveal')) {
    return 'viewSecrets'
  }
  if (method === 'GET' || path.startsWith('/api/profile/') || /^\/api\/projects\/[^/]+\/(export|pin)$/.test(path)) {
    return undefined
  }
  if (path.startsWith('/api/tech-stacks')) {
    return 'manageTechStacks'
  }
  return 'edit'
}

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/') && !path.startsWith('/uploads/')) {
    return
  }
  if (PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  // Every account must set up two-factor before it can use the app.
  if (!session.user.twoFactorEnabled) {
    throw createError({ statusCode: 403, statusMessage: 'TWO_FACTOR_REQUIRED' })
  }
  const permission = requiredPermission(path, event.method)
  if (permission && !hasPermission(session.user.role, permission)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  event.context.user = session.user
  event.context.session = session.session

  // Anything inside a locked group needs its access code first. A project in
  // the trash, and everything in it, is gone until it is restored.
  const scope = await projectScopeForPath(path)
  if (scope) {
    await assertGroupOpen(event, scope.groupId)
    if (scope.trashed && !/^\/api\/projects\/[^/]+\/restore$/.test(path)) {
      notFound()
    }
  }
})
