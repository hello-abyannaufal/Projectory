import ConfirmModal from '~/components/ConfirmModal.vue'

export function useConfirm() {
  const overlay = useOverlay()
  const modal = overlay.create(ConfirmModal)

  return async (props: { title: string, description?: string, confirmLabel?: string }) => {
    const confirmed = await modal.open(props).result
    return confirmed === true
  }
}
