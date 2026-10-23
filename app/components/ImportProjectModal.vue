<script setup lang="ts">
const props = defineProps<{
  // Preselected target group
  groupId?: string
}>()

const emit = defineEmits<{ imported: [id: string] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()

const { data: groups } = useGroups()
const groupItems = computed(() => groups.value.filter(group => !group.locked).map(group => ({ value: group.id, label: group.name })))
const selectedGroupId = ref('')

const file = ref<File>()
const passphrase = ref('')
const needsPassphrase = ref(false)
const error = ref<string>()
const loading = ref(false)

watch(open, (value) => {
  if (value) {
    file.value = undefined
    selectedGroupId.value = props.groupId ?? groupItems.value[0]?.value ?? ''
    passphrase.value = ''
    needsPassphrase.value = false
    error.value = undefined
  }
})

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0]
  needsPassphrase.value = false
  error.value = undefined
}

async function submit() {
  if (!file.value || !selectedGroupId.value) {
    return
  }
  const body = new FormData()
  body.append('file', file.value)
  body.append('groupId', selectedGroupId.value)
  if (passphrase.value) {
    body.append('passphrase', passphrase.value)
  }
  loading.value = true
  error.value = undefined
  try {
    const result = await request<{ id: string }>('/api/projects/import', { method: 'POST', body })
    open.value = false
    toast.add({ title: t('import.done'), color: 'success' })
    emit('imported', result.id)
  } catch (err) {
    const code = (err as { data?: { statusMessage?: string } }).data?.statusMessage
    if (code === 'PASSPHRASE_REQUIRED' || code === 'INVALID_PASSPHRASE') {
      needsPassphrase.value = true
    }
    error.value = code && ['PASSPHRASE_REQUIRED', 'INVALID_PASSPHRASE', 'INVALID_FILE'].includes(code)
      ? t(`import.errors.${code}`)
      : t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('import.title')"
    :description="t('import.description')"
  >
    <template #body>
      <form
        id="import-form"
        class="flex flex-col gap-4"
        @submit.prevent="submit"
      >
        <label class="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accented bg-elevated/40 p-6 text-center">
          <UIcon
            name="i-lucide-file-archive"
            class="size-8 text-primary"
          />
          <span class="font-semibold text-highlighted">{{ file?.name ?? t('import.chooseFile') }}</span>
          <span class="text-xs text-muted">.projectory.zip</span>
          <input
            type="file"
            accept=".zip,application/zip"
            class="sr-only"
            @change="onFile"
          >
        </label>
        <UFormField :label="t('groups.group')">
          <USelect
            v-model="selectedGroupId"
            :items="groupItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="needsPassphrase"
          :label="t('export.passphrase')"
        >
          <UInput
            v-model="passphrase"
            type="password"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
        />
        <p class="text-xs text-muted">
          {{ t('import.hint') }}
        </p>
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
          form="import-form"
          icon="i-lucide-upload"
          :loading="loading"
          :disabled="!file || !selectedGroupId"
          :label="t('import.button')"
        />
      </div>
    </template>
  </UModal>
</template>
