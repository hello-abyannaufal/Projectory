// The clipboard API only exists on HTTPS and localhost. Over plain HTTP, copy
// through a hidden textarea instead.
async function writeClipboard(text: string) {
  if (window.isSecureContext && navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  // Inside an open dialog, focus is trapped, so the textarea has to live in it.
  const host = document.activeElement?.closest('[role="dialog"]') ?? document.body
  host.append(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) {
    throw new Error('copy failed')
  }
}

export function useCopy() {
  const toast = useToast()
  const { t } = useI18n()

  return async (text: string) => {
    try {
      await writeClipboard(text)
      toast.add({ title: t('common.copied'), icon: 'i-lucide-check', duration: 1500 })
    } catch {
      toast.add({ title: t('common.error'), color: 'error' })
    }
  }
}
