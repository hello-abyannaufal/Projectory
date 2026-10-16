<script setup lang="ts">
const props = defineProps<{
  group?: Group
}>()

const emit = defineEmits<{ unlocked: [] }>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const accessCode = ref('')
const error = ref<string>()
const loading = ref(false)

watch(open, (value) => {
  if (value) {
    accessCode.value = ''
    error.value = undefined
  }
})

async function submit() {
  if (!props.group || !accessCode.value) {
    return
  }
  loading.value = true
  error.value = undefined
  try {
    await request(`/api/groups/${props.group.id}/unlock`, { method: 'POST', body: { accessCode: accessCode.value } })
    open.value = false
    emit('unlocked')
  } catch (err) {
    const code = (err as { data?: { statusMessage?: string } }).data?.statusMessage
    error.value = code === 'INVALID_ACCESS_CODE'
      ? t('groups.invalidAccessCode')
      : code === 'TOO_MANY_ATTEMPTS'
        ? t('groups.tooManyAttempts', { minutes: GROUP_UNLOCK_WINDOW_MINUTES })
        : t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('groups.unlockTitle', { name: group?.name ?? '' })"
    :description="t('groups.unlockDescription')"
  >
    <template #body>
      <form
        id="unlock-group-form"
        class="flex flex-col gap-3"
        @submit.prevent="submit"
      >
        <UFormField
          :label="t('groups.accessCode')"
          :error="error"
        >
          <UInput
            v-model="accessCode"
            type="password"
            autocomplete="off"
            icon="i-lucide-key-round"
            class="w-full"
            autofocus
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="unlock-group-form"
          icon="i-lucide-lock-open"
          :loading="loading"
          :disabled="!accessCode"
          :label="t('groups.unlock')"
        />
      </div>
    </template>
  </UModal>
</template>
