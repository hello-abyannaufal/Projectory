<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type * as z from 'zod'

const props = defineProps<{
  deploymentId: string
  // Existing variable with its revealed value
  envVar?: { id: string, key: string, value: string }
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const api = useApi()

const state = reactive({ key: '', value: '' })

watch(open, (value) => {
  if (value) {
    Object.assign(state, { key: props.envVar?.key ?? '', value: props.envVar?.value ?? '' })
  }
})

const loading = ref(false)

async function onSubmit({ data }: FormSubmitEvent<z.output<typeof envVarInput>>) {
  loading.value = true
  const url = props.envVar ? `/api/env-vars/${props.envVar.id}` : `/api/deployments/${props.deploymentId}/env`
  const saved = await api(() => request(url, { method: props.envVar ? 'PATCH' : 'POST', body: data }))
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
    :title="envVar ? t('env.editVariable') : t('env.addVariable')"
  >
    <template #body>
      <UForm
        id="env-var-form"
        :schema="envVarInput"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="t('env.key')"
          name="key"
          required
        >
          <UInput
            v-model="state.key"
            class="w-full font-mono"
            placeholder="NUXT_PUBLIC_API_BASE_URL"
            autofocus
          />
        </UFormField>
        <UFormField
          :label="t('env.value')"
          name="value"
        >
          <UTextarea
            v-model="state.value"
            class="w-full"
            :rows="2"
            autoresize
            spellcheck="false"
            :ui="{ base: 'font-mono text-sm' }"
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
          form="env-var-form"
          :loading="loading"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
