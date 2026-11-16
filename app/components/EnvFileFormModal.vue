<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  deploymentId: string
  // Existing file to rename; without it a new file is added.
  file?: { id: string, path: string }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({ path: '' })

watch(open, (value) => {
  if (value) {
    state.path = props.file?.path ?? ''
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof envFileInput>>) {
  loading.value = true
  const saved = await api(() => props.file
    ? request(`/api/env-files/${props.file.id}`, { method: 'PATCH', body: data })
    : request(`/api/deployments/${props.deploymentId}/env-files`, { method: 'POST', body: data }))
  loading.value = false
  if (saved) {
    open.value = false
    emit('saved')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="file ? t('env.renameFile') : t('env.addFile')"
  >
    <template #body>
      <UForm
        id="env-file-form"
        :schema="envFileInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('env.filePath')"
          name="path"
          :help="t('env.filePathHint')"
          required
        >
          <UInput
            v-model="state.path"
            class="w-full font-mono"
            placeholder="dev/.env"
            autofocus
          />
        </UFormField>
      </UForm>
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
          form="env-file-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
