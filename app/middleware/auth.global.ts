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

  const { data: session } = await authClient.useSession(useFetch)
  if (!session.value && to.path !== '/login') {
    return navigateTo('/login')
  }
  if (session.value && to.path === '/login') {
    return navigateTo('/projects')
  }
})
