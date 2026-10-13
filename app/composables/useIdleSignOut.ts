const STORAGE_KEY = 'projectory:last-activity'
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

// Signs out after IDLE_TIMEOUT_MS without input. The last activity is shared
// through localStorage, so working in one tab keeps the other tabs signed in.
export function useIdleSignOut() {
  let last = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined

  function readShared() {
    try {
      return Number(localStorage.getItem(STORAGE_KEY)) || 0
    } catch {
      return 0
    }
  }

  // Throttled: input events fire constantly.
  function markActive(force = false) {
    const now = Date.now()
    if (!force && now - last < 5000) {
      return
    }
    last = now
    try {
      localStorage.setItem(STORAGE_KEY, String(now))
    } catch {
      // Storage blocked: this tab still tracks its own activity.
    }
  }

  const onActivity = () => markActive()

  async function check() {
    if (Date.now() - Math.max(last, readShared()) < IDLE_TIMEOUT_MS) {
      return
    }
    clearInterval(timer)
    await authClient.signOut()
    await navigateTo({ path: '/login', query: { idle: '1' } })
  }

  // A laptop waking from sleep fires no input event first.
  function onVisible() {
    if (document.visibilityState === 'visible') {
      check()
    }
  }

  onMounted(() => {
    markActive(true)
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    timer = setInterval(check, 30_000)
  })

  onBeforeUnmount(() => {
    ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, onActivity))
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  })
}
