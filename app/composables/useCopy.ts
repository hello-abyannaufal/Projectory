export function useCopy() {
  const toast = useToast()
  const { t } = useI18n()

  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.add({ title: t('common.copied'), icon: 'i-lucide-check', duration: 1500 })
    } catch {
      toast.add({ title: t('common.error'), color: 'error' })
    }
  }
}
