// Native HTML5 drag-and-drop reordering for a v-for list: bind `handle(index)` on
// the grip and `item(index)` on the row. The list is reordered in place while
// hovering, and `onSorted` runs once on drop when the order actually changed.
export function useDragSort<T>(list: () => T[], onSorted?: () => void) {
  const dragging = ref<number | null>(null)
  let moved = false

  function handle(index: number) {
    return {
      draggable: 'true',
      onDragstart(event: DragEvent) {
        dragging.value = index
        moved = false
        const row = (event.target as HTMLElement).closest('[data-sort-item]')
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move'
          // Firefox only starts a drag when data is set.
          event.dataTransfer.setData('text/plain', '')
          if (row) {
            const rect = row.getBoundingClientRect()
            event.dataTransfer.setDragImage(row, event.clientX - rect.left, event.clientY - rect.top)
          }
        }
      },
      onDragend() {
        dragging.value = null
        if (moved) {
          onSorted?.()
        }
      }
    }
  }

  function item(index: number) {
    return {
      'data-sort-item': '',
      onDragover(event: DragEvent) {
        const from = dragging.value
        if (from === null) {
          return
        }
        event.preventDefault()
        if (from !== index) {
          const items = list()
          items.splice(index, 0, ...items.splice(from, 1))
          dragging.value = index
          moved = true
        }
      }
    }
  }

  return { dragging, handle, item }
}
