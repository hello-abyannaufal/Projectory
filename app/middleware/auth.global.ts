export default defineNuxtRouteMiddleware(async (to) => {
  // Once an account exists it can never go away, so only check until then.
  const setupDone = useState('setup-done', () => false)
  if (!setupDone.value) {
    const { needsSetup } = await useRequestFetch()('/api/setup')
    if (needsSetup) {
      return to.path === '/setup' ? undefined : navigateTo('/setup')
    }
    setupDone.value = true
  }
  if (to.path === '/setup') {
    return navigateTo('/login')
  }

  // On the client, useFetch would reuse the session cached during SSR,
  // which is stale right after signing in or out.
  const session = import.meta.server
    ? (await authClient.useSession(useFetch)).data.value
    : (await authClient.getSession()).data
  // Read by usePermissions(); set here so SSR renders with the right role.
  useRole().value = session?.user.role as Role | undefined
  if (!session && to.path !== '/login') {
    return navigateTo('/login')
  }
  // Every account must set up two-factor before it can use the app.
  if (session && !session.user.twoFactorEnabled) {
    return to.path === '/two-factor' ? undefined : navigateTo('/two-factor')
  }
  if (to.path === '/two-factor') {
    return navigateTo('/projects')
  }
  if (session && to.path === '/login') {
    return navigateTo('/projects')
  }
  if (to.meta.permission && !hasPermission(session?.user.role, to.meta.permission)) {
    return navigateTo('/projects')
  }
})
