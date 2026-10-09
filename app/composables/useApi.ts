// Runs a mutation and shows a toast on failure. Returns undefined when it failed.
export function useApi() {
  const toast = useToast()
  const { t } = useI18n()

  return async function <T>(request: () => Promise<T>, successMessage?: string): Promise<T | undefined> {
    try {
      const result = await request()
      if (successMessage) {
        toast.add({ title: successMessage, color: 'success' })
      }
      return result
    } catch (error) {
      const message = (error as { data?: { statusMessage?: string, message?: string } }).data?.statusMessage
      toast.add({ title: message || t('common.error'), color: 'error' })
      return undefined
    }
  }
}
