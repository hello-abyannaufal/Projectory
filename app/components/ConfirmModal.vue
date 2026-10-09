<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  confirmLabel?: string
}>()

const emit = defineEmits<{ close: [confirmed: boolean] }>()

const { t } = useI18n()
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="false"
    :dismissible="false"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.cancel')"
          @click="emit('close', false)"
        />
        <UButton
          color="error"
          :label="confirmLabel ?? t('common.delete')"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>
